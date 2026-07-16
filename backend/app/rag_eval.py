import json
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from .config import settings
from .knowledge_rag import search_knowledge_nodes
from .search import SearchTuning, search_entries, tuning_payload


def normalized_source_key(value: str) -> str:
    return "".join(character.lower() for character in (value or "") if character.isalnum())

DEFAULT_RAG_EVAL_QUESTIONS = [
    {"id": "rag-retrieval", "question": "RAG 系统是怎么检索知识库内容的？", "expected_terms": ["rag", "知识库", "检索"]},
    {"id": "milvus-vector", "question": "Milvus 在向量检索里解决什么问题？", "expected_terms": ["milvus", "向量", "检索"]},
    {"id": "agent-memory", "question": "Agent Memory 应该怎么设计？", "expected_terms": ["agent", "memory", "记忆"]},
    {"id": "redis-ai-cache", "question": "Redis 适合放在 AI 系统的什么位置？", "expected_terms": ["redis", "缓存", "ai"]},
]


def normalize_case(raw_case: Any, index: int) -> dict[str, Any] | None:
    if isinstance(raw_case, str):
        question = raw_case.strip()
        return {"id": f"case-{index + 1}", "question": question, "expected_terms": [], "expected_slugs": []} if question else None
    if not isinstance(raw_case, dict):
        return None
    question = str(raw_case.get("question", "")).strip()
    if not question:
        return None
    expected_terms = raw_case.get("expected_terms", raw_case.get("expected", []))
    expected_slugs = raw_case.get("expected_slugs", raw_case.get("expected_sources", []))
    return {
        "id": str(raw_case.get("id") or f"case-{index + 1}"),
        "question": question,
        "expected_terms": [str(item).lower() for item in expected_terms if str(item).strip()] if isinstance(expected_terms, list) else [],
        "expected_slugs": [str(item).lower() for item in expected_slugs if str(item).strip()] if isinstance(expected_slugs, list) else [],
        "category": str(raw_case.get("category") or ""),
        "note": str(raw_case.get("note") or ""),
    }


def load_eval_cases(raw_questions: Any = None) -> tuple[list[dict[str, Any]], str]:
    if isinstance(raw_questions, list) and raw_questions:
        raw_cases = raw_questions
        source = "payload"
    else:
        eval_path = Path(settings.rag_eval_path)
        if eval_path.exists():
            try:
                document = json.loads(eval_path.read_text(encoding="utf-8"))
                raw_cases = document.get("cases", document) if isinstance(document, dict) else document
                source = str(eval_path)
            except (OSError, json.JSONDecodeError):
                raw_cases = DEFAULT_RAG_EVAL_QUESTIONS
                source = "default"
        else:
            raw_cases = DEFAULT_RAG_EVAL_QUESTIONS
            source = "default"

    cases = [case for index, raw_case in enumerate(raw_cases[:50]) if (case := normalize_case(raw_case, index))]
    return cases, source


def evaluate_retrieval(
    session: Session,
    cases: list[dict[str, Any]],
    limit: int = 5,
    published_only: bool = True,
    tuning: SearchTuning | None = None,
) -> dict[str, Any]:
    evaluated_cases = []
    reciprocal_ranks = []
    top1_hits = 0
    expected_hits = 0
    answered_count = 0
    scored_count = 0

    for case in cases:
        ranked = search_entries(session, case["question"], limit=limit, published_only=published_only, tuning=tuning)
        node_ranked = search_knowledge_nodes(session, case["question"], limit=limit)
        combined = [
            {
                "entity_type": item.entry.entity_type,
                "slug": item.entry.slug,
                "title": item.entry.title,
                "searchable": " ".join([item.entry.slug, item.entry.title, item.entry.summary, item.entry.category, item.entry.content_md[:1200]]).lower(),
                "score": item.score,
                "retrieval_score": item.retrieval_score,
                "lexical_score": item.lexical_score,
                "vector_score": item.vector_score,
                "rerank_score": item.rerank_score,
                "rerank_reasons": item.rerank_reasons or [],
                "fusion_score": item.fusion_score,
                "matched_queries": item.matched_queries or [],
                "retrieval_store": item.retrieval_store,
                "chunk_index": item.chunk_index,
                "matched_chunk": (item.chunk_text or item.entry.summary or item.entry.content_md)[:260],
            }
            for item in ranked
        ] + [
            {
                "entity_type": "knowledge_node",
                "slug": hit.node.slug,
                "title": hit.node.title,
                "searchable": " ".join([hit.node.slug, hit.node.title, hit.node.summary, hit.node.content_markdown, *hit.payload["tags"], *hit.payload["columns"]]).lower(),
                "score": hit.score,
                "retrieval_score": hit.score,
                "lexical_score": hit.lexical_score,
                "vector_score": hit.vector_score,
                "rerank_score": 0,
                "rerank_reasons": ["标准化知识节点", *hit.payload["graph_relations"][:2]],
                "fusion_score": 0,
                "matched_queries": [],
                "retrieval_store": hit.retrieval_store,
                "chunk_index": None,
                "matched_chunk": hit.payload["context"][:260],
            }
            for hit in node_ranked
        ]
        node_keys = {
            normalized_source_key(value)
            for item in combined
            if item["entity_type"] == "knowledge_node"
            for value in (item["slug"], item["title"])
            if value
        }
        combined = [
            item for item in combined
            if not (
                item["entity_type"] == "knowledge"
                and any(normalized_source_key(value) in node_keys for value in (item["slug"], item["title"]) if value)
            )
        ]
        combined = sorted(combined, key=lambda item: (item["score"], item["entity_type"] == "knowledge_node"), reverse=True)[:limit]
        source_payload = []
        hit_rank = None
        expected_terms = case.get("expected_terms", [])
        expected_slugs = case.get("expected_slugs", [])

        for rank, item in enumerate(combined, start=1):
            slug_hit = bool(expected_slugs and item["slug"].lower() in expected_slugs)
            term_hit = bool(expected_terms and any(term in item["searchable"] for term in expected_terms))
            is_expected = slug_hit or term_hit
            if is_expected and hit_rank is None:
                hit_rank = rank
            source_payload.append(
                {
                    "rank": rank,
                    "entity_type": item["entity_type"],
                    "slug": item["slug"],
                    "title": item["title"],
                    "score": round(item["score"], 4),
                    "retrieval_score": round(item["retrieval_score"], 4),
                    "lexical_score": item["lexical_score"],
                    "vector_score": round(item["vector_score"], 4),
                    "rerank_score": round(item["rerank_score"], 4),
                    "rerank_reasons": item["rerank_reasons"],
                    "fusion_score": round(item["fusion_score"], 6),
                    "matched_queries": item["matched_queries"],
                    "retrieval_store": item["retrieval_store"],
                    "chunk_index": item["chunk_index"],
                    "matched_chunk": item["matched_chunk"],
                    "expected": is_expected,
                }
            )

        has_expectation = bool(expected_terms or expected_slugs)
        if source_payload:
            answered_count += 1
        if has_expectation:
            scored_count += 1
            if hit_rank:
                expected_hits += 1
                reciprocal_ranks.append(1 / hit_rank)
                if hit_rank == 1:
                    top1_hits += 1
            else:
                reciprocal_ranks.append(0)

        evaluated_cases.append(
            {
                **case,
                "expected": expected_terms,
                "expected_hit": bool(hit_rank) if has_expectation else None,
                "expected_rank": hit_rank,
                "source_count": len(source_payload),
                "top_score": source_payload[0]["score"] if source_payload else 0,
                "top_source": source_payload[0] if source_payload else None,
                "sources": source_payload,
            }
        )

    avg_top_score = sum(float(case["top_score"]) for case in evaluated_cases) / len(evaluated_cases) if evaluated_cases else 0
    return {
        "stats": {
            "cases": len(evaluated_cases),
            "answered": answered_count,
            "answer_rate": round(answered_count / len(evaluated_cases), 2) if evaluated_cases else 0,
            "expected_hits": expected_hits,
            "expected_hit_rate": round(expected_hits / scored_count, 2) if scored_count else 0,
            "top1_hits": top1_hits,
            "top1_hit_rate": round(top1_hits / scored_count, 2) if scored_count else 0,
            "mrr": round(sum(reciprocal_ranks) / scored_count, 4) if scored_count else 0,
            "avg_top_score": round(avg_top_score, 4),
            "published_only": published_only,
            "tuning": tuning_payload(tuning) if tuning else {},
        },
        "cases": evaluated_cases,
    }


def compare_retrieval_tunings(
    session: Session,
    cases: list[dict[str, Any]],
    tunings: list[SearchTuning],
    limit: int = 5,
    published_only: bool = True,
) -> list[dict[str, Any]]:
    comparisons = []
    for tuning in tunings:
        result = evaluate_retrieval(session, cases, limit=limit, published_only=published_only, tuning=tuning)
        comparisons.append(
            {
                "name": tuning.name,
                "tuning": tuning_payload(tuning),
                "stats": result["stats"],
            }
        )
    return sorted(
        comparisons,
        key=lambda item: (
            float(item["stats"].get("mrr", 0)),
            float(item["stats"].get("top1_hit_rate", 0)),
            float(item["stats"].get("expected_hit_rate", 0)),
        ),
        reverse=True,
    )
