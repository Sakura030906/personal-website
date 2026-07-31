import hashlib
import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..activity import record_activity
from ..database import get_session
from ..models import (
    AiFeedback, AiMemory, InboxItem, LongTermMemory, ProactiveTask, ReviewState, SearchEvent,
)
from ..schemas import LongTermMemoryAction, LongTermMemoryWrite, ProactiveTaskAction
from ..security import require_admin


router = APIRouter()


def aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def task_fingerprint(task_type: str, source_type: str, source_id: int | None, key: str = "") -> str:
    raw = f"{task_type}:{source_type}:{source_id or 0}:{key.strip().casefold()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def task_payload(task: ProactiveTask) -> dict:
    try:
        payload = json.loads(task.payload_json or "{}")
    except json.JSONDecodeError:
        payload = {}
    return {
        "id": task.id, "fingerprint": task.fingerprint, "task_type": task.task_type,
        "priority": task.priority, "title": task.title, "description": task.description,
        "status": task.status, "source_type": task.source_type, "source_id": task.source_id,
        "payload": payload, "due_at": task.due_at, "resolved_at": task.resolved_at,
        "created_at": task.created_at, "updated_at": task.updated_at,
    }


def memory_payload(memory: LongTermMemory) -> dict:
    return {
        "id": memory.id, "title": memory.title, "content": memory.content,
        "memory_type": memory.memory_type, "status": memory.status,
        "visibility": memory.visibility, "source_type": memory.source_type,
        "source_id": memory.source_id, "confidence": memory.confidence,
        "confirmed_by_email": memory.confirmed_by_email,
        "confirmed_at": memory.confirmed_at, "created_at": memory.created_at,
        "updated_at": memory.updated_at,
    }


def upsert_task(session: Session, *, task_type: str, priority: str, title: str, description: str,
                source_type: str, source_id: int | None = None, key: str = "",
                payload: dict | None = None, due_at: datetime | None = None) -> ProactiveTask:
    fingerprint = task_fingerprint(task_type, source_type, source_id, key)
    task = session.scalar(select(ProactiveTask).where(ProactiveTask.fingerprint == fingerprint))
    if task is None:
        task = ProactiveTask(fingerprint=fingerprint, task_type=task_type, source_type=source_type, source_id=source_id)
        session.add(task)
    task.priority = priority
    task.title = title[:255]
    task.description = description
    task.payload_json = json.dumps(payload or {}, ensure_ascii=False, default=str)
    task.due_at = due_at
    if task.status not in {"completed", "dismissed"}:
        task.status = "pending"
        task.resolved_at = None
    return task


def refresh_tasks(session: Session, now: datetime) -> int:
    generated = 0
    inbox = list(session.scalars(select(InboxItem).where(InboxItem.deleted_at.is_(None), InboxItem.status == "inbox")))
    for item in inbox:
        upsert_task(
            session, task_type="organize_inbox", priority="high" if (now - aware(item.created_at)).days >= 7 else "medium",
            title=f"整理收件箱：{item.title or '未命名记录'}", description="将记录归入文章、知识节点或项目，并确认可见性。",
            source_type="inbox", source_id=item.id, due_at=item.created_at,
        )
        generated += 1

    for state in session.scalars(select(ReviewState)):
        due_at = aware(state.next_review_at)
        if state.status == "pending" or due_at is None or due_at <= now:
            upsert_task(
                session, task_type="review_due", priority="high" if due_at and (now - due_at).days >= 7 else "medium",
                title=f"完成到期回顾：{state.entity_type} #{state.entity_id}",
                description=state.note or "重新阅读并记录本次理解变化。", source_type=state.entity_type,
                source_id=state.entity_id, key=due_at.date().isoformat() if due_at else "unscheduled", due_at=due_at,
            )
            generated += 1

    cutoff = now - timedelta(days=14)
    negative = list(session.scalars(select(AiFeedback).where(AiFeedback.rating == "not_useful")))
    for item in negative:
        if aware(item.created_at) < cutoff:
            continue
        question = (item.question or item.note or "未记录问题").strip()
        upsert_task(
            session, task_type="improve_answer", priority="high", title=f"修复低质量回答：{question}",
            description=item.reason or "补充可引用的知识节点或文章，并重新运行评测。",
            source_type="ai_feedback", source_id=item.id, key=question, payload={"question": question},
        )
        generated += 1

    searches = [event for event in session.scalars(select(SearchEvent)) if aware(event.created_at) >= cutoff and event.query.strip()]
    zero_counts = Counter(event.query.strip() for event in searches if event.result_count == 0)
    for query, count in zero_counts.items():
        if count < 2:
            continue
        upsert_task(
            session, task_type="search_gap", priority="medium", title=f"补充搜索缺口：{query}",
            description=f"最近 14 天有 {count} 次搜索没有结果。", source_type="search", key=query,
            payload={"query": query, "count": count},
        )
        generated += 1

    low_quality = list(session.scalars(select(AiMemory).where(AiMemory.quality_score < 0.45)))
    for item in low_quality:
        if aware(item.created_at) < cutoff:
            continue
        upsert_task(
            session, task_type="rag_quality", priority="medium", title=f"检查 RAG 依据：{item.question}",
            description=f"质量分 {item.quality_score:.2f}，检查召回范围、引用和知识内容。",
            source_type="ai_memory", source_id=item.id, key=item.question,
            payload={"question": item.question, "quality_score": item.quality_score},
        )
        generated += 1
    session.commit()
    return generated


def dashboard_payload(session: Session, now: datetime) -> dict:
    tasks = list(session.scalars(select(ProactiveTask).order_by(ProactiveTask.created_at.desc(), ProactiveTask.id.desc())))
    memories = list(session.scalars(select(LongTermMemory).order_by(LongTermMemory.updated_at.desc(), LongTermMemory.id.desc())))
    open_tasks = [task for task in tasks if task.status in {"pending", "accepted"}]
    priority_order = {"high": 0, "medium": 1, "low": 2}
    open_tasks.sort(key=lambda task: (priority_order.get(task.priority, 9), aware(task.due_at) or now, task.id))
    return {
        "generated_at": now,
        "stats": {
            "open_tasks": len(open_tasks), "high_priority": sum(task.priority == "high" for task in open_tasks),
            "memory_candidates": sum(memory.status == "candidate" for memory in memories),
            "active_memories": sum(memory.status == "active" for memory in memories),
            "public_memories": sum(memory.status == "active" and memory.visibility == "public" for memory in memories),
        },
        "focus": [task_payload(task) for task in open_tasks[:5]],
        "tasks": [task_payload(task) for task in open_tasks[:80]],
        "memories": [memory_payload(memory) for memory in memories[:80]],
    }


@router.get("/proactive/dashboard")
def proactive_dashboard(refresh: bool = True, _: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    now = datetime.now(timezone.utc)
    if refresh:
        refresh_tasks(session, now)
    return dashboard_payload(session, now)


@router.post("/proactive/refresh")
def proactive_refresh(_: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    now = datetime.now(timezone.utc)
    generated = refresh_tasks(session, now)
    return {"generated": generated, **dashboard_payload(session, now)}


@router.patch("/proactive/tasks/{task_id}")
def update_task(task_id: int, payload: ProactiveTaskAction, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    task = session.get(ProactiveTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = payload.status
    task.resolved_at = datetime.now(timezone.utc) if payload.status in {"completed", "dismissed"} else None
    if payload.note.strip():
        data = json.loads(task.payload_json or "{}")
        data["resolution_note"] = payload.note.strip()
        task.payload_json = json.dumps(data, ensure_ascii=False)
    record_activity(session, action=f"proactive_task_{payload.status}", entity_type="proactive_task", entity_id=task.id,
                    entity_title=task.title, actor_email=user)
    session.commit()
    session.refresh(task)
    return task_payload(task)


@router.post("/long-term-memories")
def create_memory(payload: LongTermMemoryWrite, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    if not payload.title.strip() or not payload.content.strip():
        raise HTTPException(status_code=400, detail="title and content are required")
    memory = LongTermMemory(**payload.model_dump())
    if memory.status == "active":
        memory.confirmed_by_email = user
        memory.confirmed_at = datetime.now(timezone.utc)
    session.add(memory)
    session.flush()
    record_activity(session, action="memory_created", entity_type="long_term_memory", entity_id=memory.id,
                    entity_title=memory.title, actor_email=user, detail={"status": memory.status, "visibility": memory.visibility})
    session.commit()
    session.refresh(memory)
    return memory_payload(memory)


@router.patch("/long-term-memories/{memory_id}")
def update_memory(memory_id: int, payload: LongTermMemoryAction, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    memory = session.get(LongTermMemory, memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    memory.status = payload.status
    if payload.visibility is not None:
        memory.visibility = payload.visibility
    if payload.status == "active":
        memory.confirmed_by_email = user
        memory.confirmed_at = datetime.now(timezone.utc)
    elif payload.status == "candidate":
        memory.confirmed_by_email = ""
        memory.confirmed_at = None
    record_activity(session, action=f"memory_{payload.status}", entity_type="long_term_memory", entity_id=memory.id,
                    entity_title=memory.title, actor_email=user, detail={"visibility": memory.visibility})
    session.commit()
    session.refresh(memory)
    return memory_payload(memory)
