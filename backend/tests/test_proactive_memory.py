from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import AiFeedback, InboxItem, LongTermMemory, ProactiveTask, ReviewState, SearchEvent
from app.routers import ai, proactive
from app.schemas import LongTermMemoryAction, LongTermMemoryWrite, ProactiveTaskAction


def make_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine, Session(engine)


def test_refresh_builds_deduplicated_tasks_from_real_signals():
    engine, session = make_session()
    try:
        now = datetime.now(timezone.utc)
        session.add_all([
            InboxItem(title="待整理笔记", status="inbox", visibility="private"),
            ReviewState(entity_type="knowledge_node", entity_id=7, status="pending", next_review_at=now - timedelta(days=8)),
            AiFeedback(rating="not_useful", question="Milvus 索引如何选择？", reason="缺少引用"),
            SearchEvent(query="RRF 调参", result_count=0),
            SearchEvent(query="RRF 调参", result_count=0),
        ])
        session.commit()

        first = proactive.refresh_tasks(session, now)
        second = proactive.refresh_tasks(session, now)
        assert first == 4
        assert second == 4
        assert session.query(ProactiveTask).count() == 4
        dashboard = proactive.dashboard_payload(session, now)
        assert dashboard["stats"]["open_tasks"] == 4
        assert dashboard["stats"]["high_priority"] == 2

        task = session.query(ProactiveTask).filter_by(task_type="organize_inbox").one()
        updated = proactive.update_task(
            task.id, ProactiveTaskAction(status="completed", note="已整理"),
            user="admin@example.com", session=session,
        )
        assert updated["status"] == "completed"
        proactive.refresh_tasks(session, now)
        assert session.get(ProactiveTask, task.id).status == "completed"
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_long_term_memory_requires_confirmation_and_visibility():
    engine, session = make_session()
    try:
        candidate = proactive.create_memory(
            LongTermMemoryWrite(
                title="职业方向", content="专注 Agent 与 RAG。", memory_type="goal", visibility="private",
            ),
            user="admin@example.com", session=session,
        )
        assert candidate["status"] == "candidate"
        assert candidate["confirmed_at"] is None

        active = proactive.update_memory(
            candidate["id"], LongTermMemoryAction(status="active", visibility="public"),
            user="admin@example.com", session=session,
        )
        assert active["status"] == "active"
        assert active["visibility"] == "public"
        assert active["confirmed_by_email"] == "admin@example.com"
        stored = session.get(LongTermMemory, candidate["id"])
        assert stored.confirmed_at is not None

        archived = proactive.update_memory(
            candidate["id"], LongTermMemoryAction(status="archived", visibility="private"),
            user="admin@example.com", session=session,
        )
        assert archived["status"] == "archived"
        assert archived["visibility"] == "private"
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_public_ai_context_excludes_candidates_and_private_memories():
    engine, session = make_session()
    try:
        session.add_all([
            LongTermMemory(title="公开目标", content="构建 RAG。", status="active", visibility="public"),
            LongTermMemory(title="私有信息", content="不能泄露。", status="active", visibility="private"),
            LongTermMemory(title="未确认信息", content="尚未确认。", status="candidate", visibility="public"),
        ])
        session.commit()
        memories = ai.confirmed_public_memories(session)
        assert [memory.title for memory in memories] == ["公开目标"]
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()
