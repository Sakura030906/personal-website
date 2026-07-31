import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agent_runtime import execute_agent_run, plan_agent_task
from ..agent_tools import list_tools
from ..config import settings
from ..database import SessionLocal, get_session
from ..models import AgentRun, AgentStep
from ..schemas import AgentConfirmation, AgentStepOut, AgentTaskCreate, AgentTaskOut, AgentToolOut
from ..security import public_session_id, resolved_public_session

router = APIRouter()


def parse_object(value: str) -> dict:
    try:
        parsed = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def parse_list(value: str) -> list:
    try:
        parsed = json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def task_out(session: Session, run: AgentRun) -> AgentTaskOut:
    steps = list(
        session.scalars(
            select(AgentStep)
            .where(AgentStep.run_id == run.id)
            .order_by(AgentStep.step_index.asc())
        )
    )
    return AgentTaskOut(
        id=run.id,
        session_id=run.session_id,
        goal=run.goal,
        scope=run.scope,
        status=run.status,
        planner_mode=run.planner_mode,
        planner=run.planner,
        plan=parse_list(run.plan_json),
        planner_trace=parse_list(run.planner_trace_json),
        result=parse_object(run.result_json),
        error=run.error,
        failure_category=run.failure_category,
        max_steps=run.max_steps,
        tool_calls=run.tool_calls,
        resume_count=run.resume_count,
        pending_confirmation=parse_object(run.pending_decision_json),
        prompt_tokens=run.prompt_tokens,
        completion_tokens=run.completion_tokens,
        estimated_cost_usd=run.estimated_cost_usd,
        steps=[
            AgentStepOut(
                id=step.id,
                step_index=step.step_index,
                tool_name=step.tool_name,
                reason=step.reason,
                planner=parse_object(step.decision_json).get("provider", "local"),
                status=step.status,
                input=parse_object(step.input_json),
                output=parse_object(step.output_json),
                error=step.error,
                duration_ms=step.duration_ms,
            )
            for step in steps
        ],
        started_at=run.started_at.isoformat() if run.started_at else "",
        completed_at=run.completed_at.isoformat() if run.completed_at else "",
        created_at=run.created_at.isoformat() if run.created_at else "",
    )


@router.get("/tools", response_model=list[AgentToolOut])
def tools() -> list[AgentToolOut]:
    return [
        AgentToolOut(
            name=tool.name,
            description=tool.description,
            scope=tool.scope,
            input_schema=tool.input_schema,
            requires_confirmation=tool.requires_confirmation,
        )
        for tool in list_tools("public")
    ]


@router.post("/tasks", response_model=AgentTaskOut)
def create_task(payload: AgentTaskCreate, session: Session = Depends(get_session), server_session: str = Depends(public_session_id)) -> AgentTaskOut:
    max_steps = min(payload.max_steps, settings.agent_max_steps)
    plan = plan_agent_task(payload.goal)[:max_steps]
    run = AgentRun(
        session_id=resolved_public_session(server_session, payload.session_id or "default"),
        goal=payload.goal.strip(),
        scope="public",
        status="pending",
        planner_mode=settings.agent_planner_provider,
        planner=settings.agent_planner_provider,
        plan_json=json.dumps(plan, ensure_ascii=False),
        max_steps=max_steps,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return task_out(session, run)


def public_run(session: Session, run_id: int, session_id: str) -> AgentRun:
    run = session.get(AgentRun, run_id)
    if not run or run.scope != "public" or run.session_id != session_id:
        raise HTTPException(status_code=404, detail="Agent task not found")
    return run


def execute_in_background(run_id: int, resume: bool = False) -> None:
    with SessionLocal() as session:
        run = session.get(AgentRun, run_id)
        if run:
            execute_agent_run(session, run, resume=resume)


@router.post("/tasks/{run_id}/run", response_model=AgentTaskOut)
def run_task(run_id: int, session_id: str = "default", session: Session = Depends(get_session), server_session: str = Depends(public_session_id)) -> AgentTaskOut:
    session_id = resolved_public_session(server_session, session_id)
    run = public_run(session, run_id, session_id)
    execute_agent_run(session, run)
    return task_out(session, run)


@router.post("/tasks/{run_id}/start", response_model=AgentTaskOut)
def start_task(
    run_id: int,
    background_tasks: BackgroundTasks,
    session_id: str = "default",
    session: Session = Depends(get_session),
    server_session: str = Depends(public_session_id),
) -> AgentTaskOut:
    session_id = resolved_public_session(server_session, session_id)
    run = public_run(session, run_id, session_id)
    if run.status not in {"pending"}:
        raise HTTPException(status_code=409, detail=f"Task cannot start from status: {run.status}")
    run.status = "queued"
    session.commit()
    session.refresh(run)
    background_tasks.add_task(execute_in_background, run.id, False)
    return task_out(session, run)


@router.post("/tasks/{run_id}/retry", response_model=AgentTaskOut)
def retry_task(
    run_id: int,
    background_tasks: BackgroundTasks,
    session_id: str = "default",
    session: Session = Depends(get_session),
    server_session: str = Depends(public_session_id),
) -> AgentTaskOut:
    session_id = resolved_public_session(server_session, session_id)
    run = public_run(session, run_id, session_id)
    if run.status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=409, detail=f"Task cannot retry from status: {run.status}")
    run.status = "queued"
    run.error = ""
    session.commit()
    session.refresh(run)
    background_tasks.add_task(execute_in_background, run.id, True)
    return task_out(session, run)


@router.post("/tasks/{run_id}/cancel", response_model=AgentTaskOut)
def cancel_task(run_id: int, session_id: str = "default", session: Session = Depends(get_session), server_session: str = Depends(public_session_id)) -> AgentTaskOut:
    session_id = resolved_public_session(server_session, session_id)
    run = public_run(session, run_id, session_id)
    if run.status not in {"pending", "queued", "running", "awaiting_confirmation"}:
        raise HTTPException(status_code=409, detail=f"Task cannot cancel from status: {run.status}")
    run.status = "cancel_requested"
    session.commit()
    session.refresh(run)
    return task_out(session, run)


@router.post("/tasks/{run_id}/confirm", response_model=AgentTaskOut)
def confirm_task(
    run_id: int,
    payload: AgentConfirmation,
    background_tasks: BackgroundTasks,
    session_id: str = "default",
    session: Session = Depends(get_session),
    server_session: str = Depends(public_session_id),
) -> AgentTaskOut:
    session_id = resolved_public_session(server_session, session_id)
    run = public_run(session, run_id, session_id)
    if run.status != "awaiting_confirmation":
        raise HTTPException(status_code=409, detail=f"Task is not awaiting confirmation: {run.status}")
    pending = parse_object(run.pending_decision_json)
    if not payload.approved:
        run.status = "cancelled"
        run.completed_at = datetime.now(timezone.utc)
        run.result_json = json.dumps(
            {
                "answer": "需要确认的工具调用已被拒绝，任务停止。",
                "sources": [],
                "generator": "human-denied",
                "quality_score": 0,
                "grounding": {"status": "cancelled"},
                "stop_reason": "人工拒绝工具调用",
            },
            ensure_ascii=False,
        )
        session.commit()
        session.refresh(run)
        return task_out(session, run)
    run.confirmation_json = json.dumps(
        {"approved": True, "signature": pending.get("signature", "")},
        ensure_ascii=False,
    )
    run.status = "queued"
    session.commit()
    session.refresh(run)
    background_tasks.add_task(execute_in_background, run.id, True)
    return task_out(session, run)


@router.get("/tasks/{run_id}", response_model=AgentTaskOut)
def get_task(run_id: int, session_id: str = "default", session: Session = Depends(get_session), server_session: str = Depends(public_session_id)) -> AgentTaskOut:
    session_id = resolved_public_session(server_session, session_id)
    run = public_run(session, run_id, session_id)
    return task_out(session, run)


@router.get("/tasks", response_model=list[AgentTaskOut])
def list_tasks(session_id: str = "default", limit: int = 20, session: Session = Depends(get_session), server_session: str = Depends(public_session_id)) -> list[AgentTaskOut]:
    session_id = resolved_public_session(server_session, session_id)
    limit = max(1, min(limit, 50))
    runs = list(
        session.scalars(
            select(AgentRun)
            .where(AgentRun.session_id == session_id, AgentRun.scope == "public")
            .order_by(AgentRun.created_at.desc(), AgentRun.id.desc())
            .limit(limit)
        )
    )
    return [task_out(session, run) for run in runs]
