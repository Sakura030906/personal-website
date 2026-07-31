import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .agent_runtime import execute_agent_run
from .config import settings
from .models import AgentRun, AgentStep


DEFAULT_AGENT_EVAL_CASES = [
    {
        "id": "compare-technologies",
        "goal": "比较 Redis 和 Milvus 的用途与差异",
        "expected_tools": ["search_content", "compare_content"],
        "min_quality": 0.35,
    },
    {
        "id": "knowledge-relations",
        "goal": "查找 Milvus 并查看它在知识图谱中的关联关系",
        "expected_tools": ["search_content", "get_content", "explore_knowledge_graph"],
        "min_quality": 0.3,
    },
    {
        "id": "recent-content",
        "goal": "查看最近发布的内容",
        "expected_tools": ["list_recent_content"],
        "min_quality": 0,
    },
]


def normalize_agent_case(raw_case: Any, index: int) -> dict[str, Any] | None:
    if not isinstance(raw_case, dict):
        return None
    goal = str(raw_case.get("goal") or raw_case.get("question") or "").strip()
    if not goal:
        return None
    expected_tools = raw_case.get("expected_tools") or []
    expected_slugs = raw_case.get("expected_slugs") or []
    return {
        "id": str(raw_case.get("id") or f"agent-case-{index + 1}"),
        "goal": goal,
        "category": str(raw_case.get("category") or "Agent"),
        "expected_tools": [str(item) for item in expected_tools if str(item).strip()],
        "expected_slugs": [str(item).lower() for item in expected_slugs if str(item).strip()],
        "expected_status": str(raw_case.get("expected_status") or "completed"),
        "min_quality": max(0.0, min(float(raw_case.get("min_quality", 0) or 0), 1.0)),
        "max_latency_ms": max(0, int(raw_case.get("max_latency_ms", 0) or 0)),
    }


def load_agent_eval_cases(raw_cases: Any = None) -> tuple[list[dict[str, Any]], str]:
    if isinstance(raw_cases, list) and raw_cases:
        source_cases = raw_cases
        source = "payload"
    else:
        path = Path(settings.agent_eval_path)
        if path.exists():
            try:
                document = json.loads(path.read_text(encoding="utf-8"))
                source_cases = document.get("cases", document) if isinstance(document, dict) else document
                source = str(path)
            except (OSError, json.JSONDecodeError):
                source_cases = DEFAULT_AGENT_EVAL_CASES
                source = "default"
        else:
            source_cases = DEFAULT_AGENT_EVAL_CASES
            source = "default"
    cases = [
        case
        for index, raw_case in enumerate(source_cases[:50])
        if (case := normalize_agent_case(raw_case, index))
    ]
    return cases, source


def evaluate_agent(
    session: Session,
    cases: list[dict[str, Any]],
    planner_mode: str = "local",
) -> dict[str, Any]:
    evaluated = []
    for case in cases:
        run = AgentRun(
            session_id=f"agent-eval-{uuid4().hex[:12]}",
            goal=case["goal"],
            scope="public",
            status="pending",
            planner_mode=planner_mode,
            planner=planner_mode,
            max_steps=settings.agent_max_steps,
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        run = execute_agent_run(session, run, use_model=planner_mode != "local")
        result = json.loads(run.result_json or "{}") if run.result_json else {}
        steps = list(
            session.scalars(
                select(AgentStep).where(AgentStep.run_id == run.id).order_by(AgentStep.step_index.asc())
            )
        )
        tools = [step.tool_name for step in steps if step.status == "completed"]
        source_slugs = [
            str(source.get("slug") or "").lower()
            for source in result.get("sources", [])
            if isinstance(source, dict) and source.get("slug")
        ]
        expected_tools = case["expected_tools"]
        expected_slugs = case["expected_slugs"]
        missing_tools = [tool for tool in expected_tools if tool not in tools]
        missing_slugs = [slug for slug in expected_slugs if slug not in source_slugs]
        latency_ms = int(result.get("latency_ms") or 0)
        quality_score = float(result.get("quality_score") or 0)
        checks = {
            "status": run.status == case["expected_status"],
            "tool_path": not missing_tools,
            "sources": not missing_slugs,
            "quality": quality_score >= case["min_quality"],
            "latency": not case["max_latency_ms"] or latency_ms <= case["max_latency_ms"],
        }
        evaluated.append(
            {
                **case,
                "run_id": run.id,
                "status": run.status,
                "success": all(checks.values()),
                "checks": checks,
                "tools": tools,
                "missing_tools": missing_tools,
                "source_slugs": source_slugs,
                "missing_slugs": missing_slugs,
                "quality_score": quality_score,
                "latency_ms": latency_ms,
                "failure_category": run.failure_category,
                "usage": {
                    "prompt_tokens": int(run.prompt_tokens or 0),
                    "completion_tokens": int(run.completion_tokens or 0),
                    "estimated_cost_usd": float(run.estimated_cost_usd or 0),
                },
            }
        )

    total = len(evaluated)
    successes = sum(1 for case in evaluated if case["success"])
    tool_hits = sum(1 for case in evaluated if case["checks"]["tool_path"])
    source_hits = sum(1 for case in evaluated if case["checks"]["sources"])
    quality_hits = sum(1 for case in evaluated if case["checks"]["quality"])
    return {
        "stats": {
            "cases": total,
            "passed": successes,
            "success_rate": round(successes / total, 2) if total else 0,
            "tool_path_rate": round(tool_hits / total, 2) if total else 0,
            "source_hit_rate": round(source_hits / total, 2) if total else 0,
            "quality_pass_rate": round(quality_hits / total, 2) if total else 0,
            "avg_quality": round(sum(case["quality_score"] for case in evaluated) / total, 2) if total else 0,
            "avg_latency_ms": round(sum(case["latency_ms"] for case in evaluated) / total) if total else 0,
            "estimated_cost_usd": round(sum(case["usage"]["estimated_cost_usd"] for case in evaluated), 8),
            "planner_mode": planner_mode,
        },
        "cases": evaluated,
    }
