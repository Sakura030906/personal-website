import json

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import ActivityEvent, AiEvalRun, AiEvalSuite, ContentEntry
from app.routers import evaluation
from app.schemas import AiEvalRunRequest, AiEvalSuiteWrite


def make_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine, Session(engine)


def test_default_suites_are_seeded_once():
    engine, session = make_session()
    try:
        first = evaluation.evaluation_dashboard(_="admin@example.com", session=session)
        second = evaluation.evaluation_dashboard(_="admin@example.com", session=session)
        assert first["stats"]["suites"] == 2
        assert second["stats"]["suites"] == 2
        assert {suite["eval_type"] for suite in first["suites"]} == {"rag", "agent"}
        assert session.query(AiEvalSuite).count() == 2
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_rag_suite_versions_runs_and_compares_regression():
    engine, session = make_session()
    try:
        session.add(ContentEntry(
            entity_type="knowledge", slug="milvus", title="Milvus",
            summary="Milvus 是 RAG 使用的向量数据库。",
            content_md="Milvus 提供向量索引和相似度检索。", status="published", visibility="public",
        ))
        session.commit()
        payload = AiEvalSuiteWrite(
            name="Milvus 固定回归", slug="milvus-regression", eval_type="rag",
            description="固定检索样本",
            cases=[{"id": "milvus", "question": "Milvus 是什么？", "expected_slugs": ["milvus"]}],
        )
        suite = evaluation.create_suite(payload, user="admin@example.com", session=session)
        first = evaluation.run_suite(
            suite["id"], AiEvalRunRequest(mode="local", limit=3),
            user="admin@example.com", session=session,
        )
        second = evaluation.run_suite(
            suite["id"], AiEvalRunRequest(mode="local", limit=3),
            user="admin@example.com", session=session,
        )
        assert first["metrics"]["mrr"] == 1.0
        assert first["regression"]["status"] == "baseline"
        assert second["regression"]["status"] == "stable"
        assert second["regression"]["previous_run_id"] == first["id"]

        updated = evaluation.update_suite(
            suite["id"], payload.model_copy(update={"description": "更新后的固定检索样本"}),
            user="admin@example.com", session=session,
        )
        assert updated["version"] == 2
        assert session.query(AiEvalRun).count() == 2
        detail = evaluation.get_run(first["id"], _="admin@example.com", session=session)
        assert detail["suite_version"] == 1
        assert detail["result"]["cases"][0]["expected_hit"] is True
        assert session.scalar(select(ActivityEvent).where(ActivityEvent.action == "evaluation_run")) is not None
        assert json.loads(session.get(AiEvalRun, second["id"]).regression_json)["status"] == "stable"
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_failed_evaluation_is_persisted_for_audit(monkeypatch):
    engine, session = make_session()
    try:
        suite = evaluation.create_suite(
            AiEvalSuiteWrite(
                name="失败审计", slug="failed-audit", eval_type="rag",
                cases=[{"id": "broken", "question": "测试", "expected_terms": ["测试"]}],
            ),
            user="admin@example.com", session=session,
        )
        monkeypatch.setattr(evaluation, "evaluate_retrieval", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")))
        with pytest.raises(HTTPException) as failed:
            evaluation.run_suite(
                suite["id"], AiEvalRunRequest(mode="local"),
                user="admin@example.com", session=session,
            )
        assert failed.value.status_code == 500
        run = session.scalar(select(AiEvalRun))
        assert run.status == "failed"
        assert json.loads(run.result_json)["error"] == "boom"
        assert session.scalar(select(ActivityEvent).where(ActivityEvent.action == "evaluation_failed")) is not None
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()
