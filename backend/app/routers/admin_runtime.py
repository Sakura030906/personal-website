from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..agent_eval import evaluate_agent, load_agent_eval_cases
from ..config import settings
from ..content_versioning import parse_json_list, parse_json_object
from ..database import get_session
from ..document_rag import rebuild_document_index
from ..embeddings import embedding_status
from ..knowledge_rag import knowledge_node_index_status, rebuild_knowledge_node_index
from ..llm import llm_status
from ..models import (
    AgentRun,
    AgentStep,
    AiMemory,
    ContentChunk,
    ContentEntry,
    Document,
    DocumentChunk,
)
from ..rag_eval import compare_retrieval_tunings, evaluate_retrieval, load_eval_cases
from ..search import rebuild_vector_index, tuning_from_payload, tuning_payload
from ..security import require_admin
from ..vector_store import vector_store_status


router = APIRouter()


@router.get("/ai-runs")
def list_ai_runs(
    limit: int = 30,
    session_id: str | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 100))
    query = select(AiMemory).order_by(AiMemory.created_at.desc(), AiMemory.id.desc()).limit(limit)
    if session_id:
        query = (
            select(AiMemory)
            .where(AiMemory.session_id == session_id)
            .order_by(AiMemory.created_at.desc(), AiMemory.id.desc())
            .limit(limit)
        )
    runs = list(session.scalars(query))
    total_latency = sum((run.latency_ms or 0) for run in runs)
    avg_latency = round(total_latency / len(runs)) if runs else 0
    avg_quality = round(sum((run.quality_score or 0) for run in runs) / len(runs), 2) if runs else 0
    grounding_reports = [parse_json_object(getattr(run, "grounding_json", "{}")) for run in runs]

    return {
        "stats": {
            "total": len(runs),
            "avg_quality": avg_quality,
            "avg_latency_ms": avg_latency,
            "local_runs": len([run for run in runs if (run.generator or "local") == "local"]),
            "llm_runs": len([run for run in runs if (run.generator or "local") != "local"]),
            "guardrail_runs": len([run for run in runs if (run.generator or "") == "guardrail"]),
            "avg_support": round(
                sum(float(report.get("support_score", 0) or 0) for report in grounding_reports) / len(grounding_reports),
                2,
            ) if grounding_reports else 0,
        },
        "runs": [
            {
                "id": run.id,
                "session_id": run.session_id,
                "question": run.question,
                "answer": run.answer,
                "source_slugs": parse_json_list(run.source_slugs),
                "sources": parse_json_list(getattr(run, "sources_json", "[]")),
                "trace": parse_json_list(getattr(run, "trace_json", "[]")),
                "prompt_context": getattr(run, "prompt_context", "") or "",
                "query_plan": parse_json_object(getattr(run, "query_plan_json", "{}")),
                "grounding": parse_json_object(getattr(run, "grounding_json", "{}")),
                "quality_score": getattr(run, "quality_score", 0) or 0,
                "generator": getattr(run, "generator", "local") or "local",
                "latency_ms": getattr(run, "latency_ms", 0) or 0,
                "created_at": run.created_at.isoformat() if run.created_at else "",
            }
            for run in runs
        ],
    }


@router.get("/agent-runs")
def list_agent_runs(
    limit: int = 30,
    session_id: str | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 100))
    query = select(AgentRun).order_by(AgentRun.created_at.desc(), AgentRun.id.desc()).limit(limit)
    if session_id:
        query = (
            select(AgentRun)
            .where(AgentRun.session_id == session_id)
            .order_by(AgentRun.created_at.desc(), AgentRun.id.desc())
            .limit(limit)
        )
    runs = list(session.scalars(query))
    payloads = []
    for run in runs:
        result = parse_json_object(run.result_json)
        steps = list(
            session.scalars(
                select(AgentStep)
                .where(AgentStep.run_id == run.id)
                .order_by(AgentStep.step_index.asc())
            )
        )
        payloads.append(
            {
                "id": run.id,
                "session_id": run.session_id,
                "goal": run.goal,
                "scope": run.scope,
                "status": run.status,
                "planner_mode": run.planner_mode,
                "planner": run.planner,
                "plan": parse_json_list(run.plan_json),
                "planner_trace": parse_json_list(run.planner_trace_json),
                "result": result,
                "error": run.error,
                "failure_category": run.failure_category,
                "max_steps": run.max_steps,
                "tool_calls": run.tool_calls,
                "resume_count": run.resume_count,
                "prompt_tokens": int(run.prompt_tokens or 0),
                "completion_tokens": int(run.completion_tokens or 0),
                "estimated_cost_usd": float(run.estimated_cost_usd or 0),
                "pending_confirmation": parse_json_object(run.pending_decision_json),
                "steps": [
                    {
                        "id": step.id,
                        "step_index": step.step_index,
                        "tool_name": step.tool_name,
                        "reason": step.reason,
                        "decision": parse_json_object(step.decision_json),
                        "status": step.status,
                        "input": parse_json_object(step.input_json),
                        "output": parse_json_object(step.output_json),
                        "error": step.error,
                        "duration_ms": step.duration_ms,
                    }
                    for step in steps
                ],
                "started_at": run.started_at.isoformat() if run.started_at else "",
                "completed_at": run.completed_at.isoformat() if run.completed_at else "",
                "created_at": run.created_at.isoformat() if run.created_at else "",
            }
        )

    completed = [item for item in payloads if item["status"] == "completed"]
    quality_values = [float(item["result"].get("quality_score") or 0) for item in completed]
    latency_values = [int(item["result"].get("latency_ms") or 0) for item in completed]
    failure_categories: dict[str, int] = {}
    for item in payloads:
        category = str(item.get("failure_category") or "")
        if category:
            failure_categories[category] = failure_categories.get(category, 0) + 1
    sorted_latencies = sorted(latency_values)
    p95_latency = sorted_latencies[min(len(sorted_latencies) - 1, int(len(sorted_latencies) * 0.95))] if sorted_latencies else 0
    return {
        "stats": {
            "total": len(payloads),
            "completed": len(completed),
            "failed": len([item for item in payloads if item["status"] == "failed"]),
            "cancelled": len([item for item in payloads if item["status"] == "cancelled"]),
            "success_rate": round(len(completed) / len(payloads), 2) if payloads else 0,
            "avg_quality": round(sum(quality_values) / len(quality_values), 2) if quality_values else 0,
            "avg_latency_ms": round(sum(latency_values) / len(latency_values)) if latency_values else 0,
            "p95_latency_ms": p95_latency,
            "tool_calls": sum(int(item["tool_calls"]) for item in payloads),
            "prompt_tokens": sum(int(item["prompt_tokens"]) for item in payloads),
            "completion_tokens": sum(int(item["completion_tokens"]) for item in payloads),
            "estimated_cost_usd": round(sum(float(item["estimated_cost_usd"]) for item in payloads), 8),
            "failure_categories": failure_categories,
        },
        "runs": payloads,
    }


@router.post("/agent/evaluate")
def evaluate_agent_suite(
    payload: dict | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    payload = payload or {}
    cases, source = load_agent_eval_cases(payload.get("cases"))
    planner_mode = str(payload.get("planner_mode") or "local").lower()
    if planner_mode not in {"local", "auto", "openai", "llm"}:
        raise HTTPException(status_code=400, detail="Unsupported planner_mode")
    evaluation = evaluate_agent(session, cases, planner_mode=planner_mode)
    return {"source": source, **evaluation}


@router.get("/rag/status")
def rag_status(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    chunk_count = session.scalar(select(func.count(ContentChunk.id))) or 0
    indexed_entries = session.scalar(select(func.count(func.distinct(ContentChunk.entry_id)))) or 0
    source_entries = session.scalar(
        select(func.count(ContentEntry.id)).where(ContentEntry.entity_type.in_(["post", "knowledge", "project", "reading"]))
    ) or 0
    published_entries = session.scalar(
        select(func.count(ContentEntry.id)).where(
            ContentEntry.entity_type.in_(["post", "knowledge", "project", "reading"]),
            ContentEntry.status == "published",
        )
    ) or 0
    last_indexed = session.scalar(select(func.max(ContentChunk.updated_at)))
    embedding_profiles = [
        {
            "provider": provider or "unknown",
            "model": model or "unknown",
            "dimensions": dimensions or 0,
            "chunks": count,
        }
        for provider, model, dimensions, count in session.execute(
            select(
                ContentChunk.embedding_provider,
                ContentChunk.embedding_model,
                ContentChunk.embedding_dimensions,
                func.count(ContentChunk.id),
            ).group_by(ContentChunk.embedding_provider, ContentChunk.embedding_model, ContentChunk.embedding_dimensions)
        )
    ]
    recent_chunks = list(session.scalars(select(ContentChunk).order_by(ContentChunk.updated_at.desc()).limit(8)))
    recent_document_chunks = list(session.scalars(select(DocumentChunk).order_by(DocumentChunk.updated_at.desc()).limit(8)))
    recent_document_ids = {chunk.document_id for chunk in recent_document_chunks}
    recent_documents = {
        document.id: document
        for document in session.scalars(select(Document).where(Document.id.in_(recent_document_ids)))
    } if recent_document_ids else {}
    node_index = knowledge_node_index_status(session)
    document_chunks = session.scalar(select(func.count(DocumentChunk.id)).where(DocumentChunk.is_enabled.is_(True))) or 0
    indexed_documents = session.scalar(select(func.count(func.distinct(DocumentChunk.document_id))).where(DocumentChunk.is_enabled.is_(True))) or 0
    return {
        "stats": {
            "chunks": chunk_count,
            "indexed_entries": indexed_entries,
            "source_entries": source_entries,
            "published_entries": published_entries,
            "coverage": round(indexed_entries / source_entries, 2) if source_entries else 0,
            "last_indexed": last_indexed.isoformat() if last_indexed else "",
            "embedding": embedding_status(),
            "llm": llm_status(),
            "embedding_profiles": embedding_profiles,
            "vector_store": vector_store_status(),
            "indexed_nodes": node_index["indexed_nodes"],
            "node_chunks": node_index["node_chunks"],
            "node_last_indexed": node_index["last_indexed"],
            "indexed_documents": indexed_documents,
            "document_chunks": document_chunks,
            "reranker": {
                "provider": settings.rag_reranker,
                "top_k": settings.rag_rerank_top_k,
                "weight": settings.rag_rerank_weight,
            },
            "query_expansion": {
                "provider": settings.rag_query_expansion,
                "max_queries": settings.rag_multi_query_limit,
                "fusion_k": settings.rag_fusion_k,
                "fusion_weight": settings.rag_fusion_weight,
            },
            "grounding": {
                "context_max_chars": settings.rag_context_max_chars,
                "evidence_threshold": settings.rag_evidence_threshold,
                "claim_support_threshold": settings.rag_claim_support_threshold,
                "min_answer_support": settings.rag_min_answer_support,
            },
        },
        "recent_chunks": [
            {
                "id": chunk.id,
                "entry_id": chunk.entry_id,
                "entity_type": chunk.entity_type,
                "slug": chunk.slug,
                "title": chunk.title,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content[:220],
                "token_count": chunk.token_count,
                "embedding_provider": getattr(chunk, "embedding_provider", "local") or "local",
                "embedding_model": getattr(chunk, "embedding_model", "hash") or "hash",
                "embedding_dimensions": getattr(chunk, "embedding_dimensions", 0) or 0,
                "updated_at": chunk.updated_at.isoformat() if chunk.updated_at else "",
            }
            for chunk in recent_chunks
        ] + [
            {
                "id": chunk.id,
                "entry_id": chunk.node_id,
                "entity_type": "knowledge_node",
                "slug": chunk.slug,
                "title": chunk.title,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content[:220],
                "token_count": chunk.token_count,
                "embedding_provider": chunk.embedding_provider,
                "embedding_model": chunk.embedding_model,
                "embedding_dimensions": chunk.embedding_dimensions,
                "updated_at": chunk.updated_at.isoformat() if chunk.updated_at else "",
            }
            for chunk in node_index["recent_chunks"][:8]
        ] + [
            {
                "id": chunk.id,
                "entry_id": chunk.document_id,
                "entity_type": "document",
                "slug": recent_documents[chunk.document_id].slug if chunk.document_id in recent_documents else "",
                "title": recent_documents[chunk.document_id].title if chunk.document_id in recent_documents else "已删除文档",
                "chunk_index": chunk.chunk_index,
                "content": chunk.content[:220],
                "token_count": chunk.token_count,
                "embedding_provider": chunk.embedding_provider,
                "embedding_model": chunk.embedding_model,
                "embedding_dimensions": chunk.embedding_dimensions,
                "updated_at": chunk.updated_at.isoformat() if chunk.updated_at else "",
            }
            for chunk in recent_document_chunks
        ],
    }


@router.post("/rag/rebuild")
def rebuild_rag_index(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    result = rebuild_vector_index(session)
    node_result = rebuild_knowledge_node_index(session)
    document_result = rebuild_document_index(session)
    return {"status": "rebuilt", **result, **node_result, **document_result}


@router.post("/rag/evaluate")
def evaluate_rag(
    payload: dict | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    payload = payload or {}
    raw_questions = payload.get("questions") if isinstance(payload, dict) else None
    limit = max(1, min(int(payload.get("limit", 5) or 5), 10))
    published_only = bool(payload.get("published_only", True))
    cases, eval_source = load_eval_cases(raw_questions)
    tuning = tuning_from_payload(payload.get("tuning") if isinstance(payload.get("tuning"), dict) else None)
    evaluation = evaluate_retrieval(session, cases, limit=limit, published_only=published_only, tuning=tuning)
    raw_compare = payload.get("compare_tunings") if isinstance(payload, dict) else None
    compare_payloads = raw_compare if isinstance(raw_compare, list) and raw_compare else [
        {"name": "balanced", "lexical_weight": 1.0, "vector_weight": 12.0, "entry_vector_weight": 10.0, "min_score": 0.15, "milvus_expand": 5, "reranker": "local", "rerank_top_k": 20, "rerank_weight": 4.0},
        {"name": "semantic", "lexical_weight": 0.6, "vector_weight": 18.0, "entry_vector_weight": 14.0, "min_score": 0.15, "milvus_expand": 8},
        {"name": "keyword", "lexical_weight": 1.4, "vector_weight": 8.0, "entry_vector_weight": 6.0, "min_score": 0.15, "milvus_expand": 5},
        {"name": "no-rerank", "lexical_weight": 1.0, "vector_weight": 12.0, "entry_vector_weight": 10.0, "min_score": 0.15, "milvus_expand": 5, "reranker": "off", "rerank_weight": 0},
        {"name": "single-query", "lexical_weight": 1.0, "vector_weight": 12.0, "entry_vector_weight": 10.0, "min_score": 0.15, "milvus_expand": 5, "query_expansion": "off", "multi_query_limit": 1},
    ]
    comparisons = compare_retrieval_tunings(
        session,
        cases,
        [tuning_from_payload(item if isinstance(item, dict) else {}) for item in compare_payloads[:10]],
        limit=limit,
        published_only=published_only,
    )

    return {
        "stats": evaluation["stats"],
        "embedding": embedding_status(),
        "vector_store": vector_store_status(),
        "source": eval_source,
        "tuning": tuning_payload(tuning),
        "comparisons": comparisons,
        "cases": evaluation["cases"],
    }
