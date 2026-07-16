import json
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .agent_tools import AgentToolContext, execute_tool, get_tool
from .agent_planner import local_next_decision, next_planner_decision, preview_plan
from .agent_synthesis import synthesize_agent_answer
from .config import settings
from .models import AgentRun, AgentStep, AiMemory


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def loads(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def plan_agent_task(goal: str) -> list[dict[str, Any]]:
    return preview_plan(goal)


def resolve_reference(value: Any, outputs: dict[int, dict]) -> Any:
    if isinstance(value, list):
        return [resolve_reference(item, outputs) for item in value]
    if isinstance(value, dict):
        return {key: resolve_reference(item, outputs) for key, item in value.items()}
    if not isinstance(value, str) or not value.startswith("$steps."):
        return value

    parts = value.split(".")
    if len(parts) < 4:
        return ""
    try:
        current: Any = outputs[int(parts[1])]
        for part in parts[2:]:
            if part == "output":
                continue
            if isinstance(current, list):
                current = current[int(part)]
            elif isinstance(current, dict):
                current = current[part]
            else:
                return ""
        return current
    except (KeyError, IndexError, TypeError, ValueError):
        return ""


def trim_result(value: dict) -> dict:
    serialized = dumps(value)
    if len(serialized) <= settings.agent_tool_result_chars:
        return value
    return {
        "truncated": True,
        "original_chars": len(serialized),
        "preview": serialized[: settings.agent_tool_result_chars],
    }


def save_agent_memory(session: Session, run: AgentRun, result: dict, planner_trace: list[dict]) -> int:
    memory_trace = [
        f"Step {int(item.get('step', 0)) + 1}: {item.get('action', '')} {item.get('tool', '')} - {item.get('reason', '')}".strip()
        for item in planner_trace
    ]
    memory = AiMemory(
        session_id=run.session_id,
        question=run.goal,
        answer=str(result.get("answer") or ""),
        source_slugs=dumps([source.get("slug") for source in result.get("sources", []) if source.get("slug")]),
        sources_json=dumps(result.get("sources", [])),
        trace_json=dumps(memory_trace),
        prompt_context=str(result.get("prompt_context") or ""),
        query_plan_json=dumps({"planner": run.planner, "plan": loads(run.plan_json, [])}),
        grounding_json=dumps(result.get("grounding", {})),
        quality_score=float(result.get("quality_score") or 0),
        generator=str(result.get("generator") or "local-agent"),
        latency_ms=int(result.get("latency_ms") or 0),
    )
    session.add(memory)
    session.flush()
    return memory.id


def call_signature(tool_name: str, arguments: dict) -> str:
    return f"{tool_name}:{json.dumps(arguments, ensure_ascii=False, sort_keys=True)}"


def classify_failure(error: Exception) -> str:
    if isinstance(error, TimeoutError):
        return "timeout"
    if isinstance(error, PermissionError):
        return "permission_denied"
    if isinstance(error, ValueError):
        return "tool_validation"
    message = str(error).lower()
    if "tool call limit" in message or "maximum" in message:
        return "limit_exceeded"
    if "database" in message or "sql" in message:
        return "database"
    return "runtime_error"


def restore_completed_steps(
    session: Session,
    run: AgentRun,
) -> tuple[dict[int, dict], list[dict], set[str], int]:
    outputs: dict[int, dict] = {}
    history: list[dict] = []
    seen_calls: set[str] = set()
    completed_indexes = []
    steps = list(
        session.scalars(
            select(AgentStep)
            .where(AgentStep.run_id == run.id)
            .order_by(AgentStep.step_index.asc())
        )
    )
    for step in steps:
        if step.status != "completed":
            session.delete(step)
            continue
        arguments = loads(step.input_json, {})
        output = loads(step.output_json, {})
        outputs[step.step_index] = output
        history.append(
            {
                "step": step.step_index,
                "tool": step.tool_name,
                "input": arguments,
                "output": output,
                "status": "completed",
            }
        )
        seen_calls.add(call_signature(step.tool_name, arguments))
        completed_indexes.append(step.step_index)
    session.commit()
    next_index = max(completed_indexes, default=-1) + 1
    return outputs, history, seen_calls, next_index


def cancelled_result(run: AgentRun, history: list[dict], planner_trace: list[dict], started: float) -> dict:
    return {
        "answer": "任务已取消，已完成步骤仍保留，可在后台查看执行轨迹。",
        "sources": [],
        "generator": "cancelled",
        "quality_score": 0,
        "grounding": {"status": "cancelled"},
        "completed_steps": len(history),
        "tool_calls": run.tool_calls,
        "planner": run.planner,
        "stop_reason": "用户取消任务",
        "planner_trace": planner_trace,
        "latency_ms": max(1, round((time.perf_counter() - started) * 1000)),
    }


def execute_agent_run(
    session: Session,
    run: AgentRun,
    resume: bool = False,
    use_model: bool = True,
) -> AgentRun:
    if run.status == "completed":
        return run
    if run.status == "cancel_requested":
        run.result_json = dumps(
            {
                "answer": "任务在开始执行前已取消。",
                "sources": [],
                "generator": "cancelled",
                "quality_score": 0,
                "grounding": {"status": "cancelled"},
                "stop_reason": "用户取消任务",
            }
        )
        run.status = "cancelled"
        run.failure_category = "cancelled"
        run.completed_at = datetime.now(timezone.utc)
        session.commit()
        return run
    if run.status == "running" and not resume:
        return run

    if resume:
        outputs, history, seen_calls, next_index = restore_completed_steps(session, run)
        actual_plan = loads(run.plan_json, [])
        planner_trace = loads(run.planner_trace_json, [])
        run.resume_count += 1
        run.tool_calls = len(history)
    else:
        existing_steps = list(session.scalars(select(AgentStep).where(AgentStep.run_id == run.id)))
        for step in existing_steps:
            session.delete(step)
        outputs = {}
        history = []
        actual_plan = []
        planner_trace = []
        seen_calls = set()
        next_index = 0
        run.tool_calls = 0
        run.prompt_tokens = 0
        run.completion_tokens = 0
        run.estimated_cost_usd = 0
        run.plan_json = "[]"
        run.planner_trace_json = "[]"
        run.pending_decision_json = "{}"
        run.confirmation_json = "{}"

    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    run.completed_at = None
    run.error = ""
    run.failure_category = ""
    session.commit()
    started = time.perf_counter()
    stop_reason = "达到最大步骤数"

    try:
        for index in range(next_index, run.max_steps):
            session.refresh(run)
            if run.status == "cancel_requested":
                run.result_json = dumps(cancelled_result(run, history, planner_trace, started))
                run.status = "cancelled"
                run.failure_category = "cancelled"
                run.completed_at = datetime.now(timezone.utc)
                session.commit()
                return run
            if run.tool_calls >= settings.agent_max_tool_calls:
                raise RuntimeError("Agent tool call limit reached")
            if time.perf_counter() - started > settings.agent_timeout_seconds:
                raise TimeoutError("Agent execution timeout")

            decision = next_planner_decision(run.goal, history, run.scope, run.planner_mode)
            if not history and decision.action == "finish":
                decision = local_next_decision(run.goal, history)
                decision.provider = "local-safety-fallback"
            decision_payload = decision.payload()
            run.prompt_tokens = int(run.prompt_tokens or 0) + decision.prompt_tokens
            run.completion_tokens = int(run.completion_tokens or 0) + decision.completion_tokens
            run.estimated_cost_usd = round(float(run.estimated_cost_usd or 0) + decision.estimated_cost_usd, 8)
            planner_trace.append({"step": index, **decision_payload})
            actual_plan.append(decision_payload)
            run.planner = decision.provider
            run.plan_json = dumps(actual_plan)
            run.planner_trace_json = dumps(planner_trace)
            session.commit()

            if decision.action == "finish":
                stop_reason = decision.reason or "规划器判断任务已经完成"
                break

            tool_name = decision.tool
            arguments = decision.arguments or {}
            signature = call_signature(tool_name, arguments)
            if signature in seen_calls:
                stop_reason = f"阻止重复工具调用：{tool_name}"
                break
            tool = get_tool(tool_name)
            if not tool:
                raise ValueError(f"Unknown tool: {tool_name}")
            confirmation = loads(run.confirmation_json, {})
            if tool.requires_confirmation and not (
                confirmation.get("approved") is True and confirmation.get("signature") == signature
            ):
                pending = {**decision_payload, "signature": signature}
                run.pending_decision_json = dumps(pending)
                run.status = "awaiting_confirmation"
                session.commit()
                session.refresh(run)
                return run
            run.pending_decision_json = "{}"
            run.confirmation_json = "{}"
            seen_calls.add(signature)
            step = AgentStep(
                run_id=run.id,
                step_index=index,
                tool_name=tool_name,
                reason=decision.reason,
                decision_json=dumps(decision_payload),
                status="running",
                input_json=dumps(arguments),
            )
            session.add(step)
            session.commit()
            step_started = time.perf_counter()
            try:
                output = execute_tool(
                    tool_name,
                    AgentToolContext(session=session, session_id=run.session_id, scope=run.scope),
                    arguments,
                )
                output = trim_result(output)
                outputs[index] = output
                history.append(
                    {
                        "step": index,
                        "tool": tool_name,
                        "input": arguments,
                        "output": output,
                        "status": "completed",
                    }
                )
                step.output_json = dumps(output)
                step.status = "completed"
            except Exception as error:
                step.status = "failed"
                step.error = str(error)[:1000]
                raise
            finally:
                step.duration_ms = max(1, round((time.perf_counter() - step_started) * 1000))
                run.tool_calls += 1
                session.commit()

        session.refresh(run)
        if run.status == "cancel_requested":
            run.result_json = dumps(cancelled_result(run, history, planner_trace, started))
            run.status = "cancelled"
            run.failure_category = "cancelled"
            run.completed_at = datetime.now(timezone.utc)
            session.commit()
            return run

        result = synthesize_agent_answer(run.goal, history, use_model=use_model)
        usage = result.get("model_usage") or {}
        run.prompt_tokens = int(run.prompt_tokens or 0) + int(usage.get("prompt_tokens") or 0)
        run.completion_tokens = int(run.completion_tokens or 0) + int(usage.get("completion_tokens") or 0)
        run.estimated_cost_usd = round(
            float(run.estimated_cost_usd or 0) + float(usage.get("estimated_cost_usd") or 0),
            8,
        )
        result["completed_steps"] = len(outputs)
        result["tool_calls"] = run.tool_calls
        result["planner"] = run.planner
        result["stop_reason"] = stop_reason
        result["planner_trace"] = planner_trace
        result["latency_ms"] = max(1, round((time.perf_counter() - started) * 1000))
        result["memory_id"] = save_agent_memory(session, run, result, planner_trace)
        result["usage"] = {
            "prompt_tokens": run.prompt_tokens,
            "completion_tokens": run.completion_tokens,
            "estimated_cost_usd": run.estimated_cost_usd,
        }
        run.result_json = dumps(result)
        run.status = "completed"
        run.pending_decision_json = "{}"
        run.confirmation_json = "{}"
        run.completed_at = datetime.now(timezone.utc)
    except Exception as error:
        run.status = "failed"
        run.error = str(error)[:2000]
        run.failure_category = classify_failure(error)
        run.completed_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(run)
    return run
