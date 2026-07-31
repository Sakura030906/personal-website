import json
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..activity import record_activity
from ..agent_eval import DEFAULT_AGENT_EVAL_CASES, evaluate_agent, normalize_agent_case
from ..database import get_session
from ..models import AiEvalRun, AiEvalSuite
from ..rag_eval import DEFAULT_RAG_EVAL_QUESTIONS, compare_retrieval_tunings, evaluate_retrieval, normalize_case
from ..schemas import AiEvalRunRequest, AiEvalSuiteWrite
from ..search import tuning_from_payload
from ..security import require_admin


router = APIRouter()


DEFAULT_SUITES = (
    {
        "name": "RAG 核心检索回归", "slug": "rag-core-regression", "eval_type": "rag",
        "description": "固定检查 RAG、Milvus、Agent Memory 与 Redis 的召回质量。",
        "cases": DEFAULT_RAG_EVAL_QUESTIONS,
    },
    {
        "name": "Agent 工具路径回归", "slug": "agent-tool-routing", "eval_type": "agent",
        "description": "固定检查检索、比较、知识图谱与最近内容工具路径。",
        "cases": DEFAULT_AGENT_EVAL_CASES,
    },
)


def json_value(raw: str, fallback):
    try:
        return json.loads(raw or "")
    except (TypeError, json.JSONDecodeError):
        return fallback


def suite_dict(suite: AiEvalSuite) -> dict:
    return {
        "id": suite.id, "name": suite.name, "slug": suite.slug, "eval_type": suite.eval_type,
        "description": suite.description, "cases": json_value(suite.cases_json, []),
        "case_count": len(json_value(suite.cases_json, [])), "version": suite.version,
        "is_active": suite.is_active, "created_by_email": suite.created_by_email,
        "created_at": suite.created_at, "updated_at": suite.updated_at,
    }


def run_dict(run: AiEvalRun, include_result: bool = False) -> dict:
    payload = {
        "id": run.id, "suite_id": run.suite_id, "eval_type": run.eval_type,
        "suite_version": run.suite_version, "mode": run.mode, "status": run.status,
        "metrics": json_value(run.metrics_json, {}), "regression": json_value(run.regression_json, {}),
        "duration_ms": run.duration_ms, "created_by_email": run.created_by_email, "created_at": run.created_at,
    }
    if include_result:
        payload["result"] = json_value(run.result_json, {})
    return payload


def ensure_default_suites(session: Session) -> None:
    existing = set(session.scalars(select(AiEvalSuite.slug)))
    for item in DEFAULT_SUITES:
        if item["slug"] not in existing:
            session.add(AiEvalSuite(
                name=item["name"], slug=item["slug"], eval_type=item["eval_type"],
                description=item["description"], cases_json=json.dumps(item["cases"], ensure_ascii=False),
                version=1, is_active=True, created_by_email="system",
            ))
    session.commit()


def normalize_cases(eval_type: str, raw_cases: list[dict]) -> list[dict]:
    normalizer = normalize_case if eval_type == "rag" else normalize_agent_case
    cases = [case for index, raw in enumerate(raw_cases[:50]) if (case := normalizer(raw, index))]
    if not cases:
        raise HTTPException(status_code=422, detail="Evaluation suite must contain at least one valid case")
    return cases


def primary_metric(eval_type: str, metrics: dict) -> tuple[str, float]:
    field = "mrr" if eval_type == "rag" else "success_rate"
    return field, float(metrics.get(field) or 0)


def regression_payload(session: Session, suite: AiEvalSuite, mode: str, metrics: dict) -> dict:
    previous = session.scalar(
        select(AiEvalRun).where(
            AiEvalRun.suite_id == suite.id, AiEvalRun.mode == mode, AiEvalRun.status == "completed",
        ).order_by(AiEvalRun.id.desc())
    )
    field, current = primary_metric(suite.eval_type, metrics)
    if not previous:
        return {"status": "baseline", "metric": field, "current": current, "previous": None, "delta": 0}
    previous_metrics = json_value(previous.metrics_json, {})
    old = float(previous_metrics.get(field) or 0)
    delta = round(current - old, 4)
    status = "improved" if delta > 0.02 else "regressed" if delta < -0.02 else "stable"
    return {"status": status, "metric": field, "current": current, "previous": old, "delta": delta, "previous_run_id": previous.id}


@router.get("/evaluation/dashboard")
def evaluation_dashboard(
    _: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    ensure_default_suites(session)
    suites = list(session.scalars(select(AiEvalSuite).order_by(AiEvalSuite.eval_type, AiEvalSuite.name)))
    runs = list(session.scalars(select(AiEvalRun).order_by(AiEvalRun.id.desc()).limit(40)))
    regressions = [run for run in runs if json_value(run.regression_json, {}).get("status") == "regressed"]
    return {
        "stats": {
            "suites": len(suites), "active_suites": len([row for row in suites if row.is_active]),
            "cases": sum(len(json_value(row.cases_json, [])) for row in suites),
            "runs": session.scalar(select(func.count(AiEvalRun.id))) or 0,
            "regressions": len(regressions),
        },
        "suites": [suite_dict(row) for row in suites],
        "runs": [run_dict(row) for row in runs],
    }


@router.post("/evaluation/suites")
def create_suite(
    payload: AiEvalSuiteWrite, user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    if session.scalar(select(AiEvalSuite).where(AiEvalSuite.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Evaluation suite slug already exists")
    cases = normalize_cases(payload.eval_type, payload.cases)
    suite = AiEvalSuite(**payload.model_dump(exclude={"cases"}), cases_json=json.dumps(cases, ensure_ascii=False), created_by_email=user)
    session.add(suite)
    session.flush()
    record_activity(session, action="created", entity_type="ai_eval_suite", entity_id=suite.id, entity_title=suite.name, actor_email=user)
    session.commit()
    session.refresh(suite)
    return suite_dict(suite)


@router.patch("/evaluation/suites/{suite_id}")
def update_suite(
    suite_id: int, payload: AiEvalSuiteWrite,
    user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    suite = session.get(AiEvalSuite, suite_id)
    if not suite:
        raise HTTPException(status_code=404, detail="Evaluation suite not found")
    duplicate = session.scalar(select(AiEvalSuite.id).where(AiEvalSuite.slug == payload.slug, AiEvalSuite.id != suite.id))
    if duplicate:
        raise HTTPException(status_code=409, detail="Evaluation suite slug already exists")
    cases = normalize_cases(payload.eval_type, payload.cases)
    for field in ("name", "slug", "eval_type", "description", "is_active"):
        setattr(suite, field, getattr(payload, field))
    suite.cases_json = json.dumps(cases, ensure_ascii=False)
    suite.version += 1
    record_activity(session, action="updated", entity_type="ai_eval_suite", entity_id=suite.id,
                    entity_title=suite.name, actor_email=user, detail={"version": suite.version})
    session.commit()
    session.refresh(suite)
    return suite_dict(suite)


@router.post("/evaluation/suites/{suite_id}/run")
def run_suite(
    suite_id: int, payload: AiEvalRunRequest,
    user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    suite = session.get(AiEvalSuite, suite_id)
    if not suite or not suite.is_active:
        raise HTTPException(status_code=404, detail="Active evaluation suite not found")
    cases = normalize_cases(suite.eval_type, json_value(suite.cases_json, []))
    started = perf_counter()
    run = AiEvalRun(
        suite_id=suite.id, eval_type=suite.eval_type, suite_version=suite.version,
        mode=payload.mode, status="running", created_by_email=user,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    try:
        if suite.eval_type == "rag":
            evaluation = evaluate_retrieval(session, cases, limit=payload.limit, published_only=payload.published_only)
            comparisons = compare_retrieval_tunings(
                session, cases,
                [tuning_from_payload({"name": "balanced"}), tuning_from_payload({"name": "semantic", "lexical_weight": .6, "vector_weight": 18}), tuning_from_payload({"name": "keyword", "lexical_weight": 1.4, "vector_weight": 8})],
                limit=payload.limit, published_only=payload.published_only,
            )
            result = {**evaluation, "comparisons": comparisons}
        else:
            result = evaluate_agent(session, cases, planner_mode=payload.mode)
        metrics = result.get("stats", {})
        regression = regression_payload(session, suite, payload.mode, metrics)
        run.status = "completed"
        run.metrics_json = json.dumps(metrics, ensure_ascii=False, default=str)
        run.result_json = json.dumps(result, ensure_ascii=False, default=str)
        run.regression_json = json.dumps(regression, ensure_ascii=False)
    except Exception as error:
        session.rollback()
        run = session.get(AiEvalRun, run.id)
        run.status = "failed"
        run.result_json = json.dumps({"error": str(error)[:1000]}, ensure_ascii=False)
        run.regression_json = json.dumps({"status": "failed"}, ensure_ascii=False)
        run.duration_ms = round((perf_counter() - started) * 1000)
        record_activity(session, action="evaluation_failed", entity_type="ai_eval_run", entity_id=run.id,
                        entity_title=suite.name, actor_email=user, detail={"suite_version": suite.version, "mode": payload.mode})
        session.commit()
        raise HTTPException(status_code=500, detail={"message": "Evaluation run failed", "run_id": run.id}) from error
    run.duration_ms = round((perf_counter() - started) * 1000)
    record_activity(session, action="evaluation_run", entity_type="ai_eval_run", entity_id=run.id,
                    entity_title=suite.name, actor_email=user, detail={"suite_version": suite.version, "mode": payload.mode, **regression})
    session.commit()
    session.refresh(run)
    return {**run_dict(run, include_result=True), "suite": suite_dict(suite)}


@router.get("/evaluation/runs/{run_id}")
def get_run(
    run_id: int, _: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    run = session.get(AiEvalRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    suite = session.get(AiEvalSuite, run.suite_id)
    return {**run_dict(run, include_result=True), "suite": suite_dict(suite) if suite else None}
