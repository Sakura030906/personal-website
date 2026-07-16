import json
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_session
from ..config import settings
from ..context_compression import compress_context
from ..document_rag import search_document_chunks
from ..embeddings import embedding_status
from ..grounding import evaluate_evidence, grounding_payload, verify_answer
from ..knowledge_rag import search_knowledge_nodes
from ..llm import build_grounded_prompt, call_openai_compatible, local_grounded_answer
from ..models import AiFeedback, AiMemory, Article, Document, KnowledgeColumn, KnowledgeNode
from ..query_expansion import build_query_plan, query_plan_payload
from ..schemas import AiFeedbackIn, AiFeedbackOut, AskRequest, AskResponse, AskSource, MemoryOut
from ..retrieval_scope import RetrievalScopeFilter
from ..search import search_entries

router = APIRouter()


def source_url(entry) -> str:
    if entry.entity_type == "knowledge":
        return f"#knowledge-{entry.slug}"
    if entry.entity_type == "project":
        return f"#project-{entry.slug}"
    if entry.entity_type == "post":
        return f"#post-{entry.slug}"
    if entry.entity_type == "reading":
        return "#reading"
    return "#"


def source_context(item) -> str:
    entry = item.entry
    metadata = {}
    try:
        metadata = json.loads(entry.metadata_json or "{}")
    except json.JSONDecodeError:
        metadata = {}

    relation_lines = []
    for key, label in [
        ("relatedKnowledge", "相关知识"),
        ("relatedProjects", "关联项目"),
        ("relatedReading", "阅读材料"),
        ("relatedPosts", "相关文章"),
    ]:
        values = metadata.get(key) or []
        if values:
            relation_lines.append(f"{label}: {', '.join(values)}")

    matched_chunk = getattr(item, "chunk_text", "") or ""
    snippet = " ".join((matched_chunk or entry.content_md or "").split())[:700]
    chunk_label = f"Matched chunk #{item.chunk_index}" if getattr(item, "chunk_index", None) is not None else ""
    return "\n".join([line for line in [entry.summary, chunk_label, snippet, *relation_lines] if line])


def parse_json_list(raw: str | None) -> list:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def parse_json_dict(raw: str | None) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def normalized_source_key(value: str) -> str:
    return "".join(character.lower() for character in (value or "") if character.isalnum())


def citation_quality(sources: list[AskSource]) -> float:
    if not sources:
        return 0
    score_total = sum(min(max(source.score, 0), 1) for source in sources)
    type_bonus = min(len({source.entity_type for source in sources}) * 0.08, 0.24)
    source_bonus = min(len(sources) * 0.07, 0.35)
    return round(min((score_total / len(sources)) * 0.7 + type_bonus + source_bonus, 1), 2)


def memory_out(memory: AiMemory) -> MemoryOut:
    source_slugs = parse_json_list(memory.source_slugs)
    raw_sources = parse_json_list(getattr(memory, "sources_json", "[]"))
    sources = []
    for source in raw_sources:
        if isinstance(source, dict):
            try:
                sources.append(AskSource(**source))
            except ValueError:
                continue
    return MemoryOut(
        id=memory.id,
        session_id=memory.session_id,
        question=memory.question,
        answer=memory.answer,
        source_slugs=source_slugs,
        sources=sources,
        trace=parse_json_list(getattr(memory, "trace_json", "[]")),
        prompt_context=getattr(memory, "prompt_context", "") or "",
        query_plan=parse_json_dict(getattr(memory, "query_plan_json", "{}")),
        grounding=parse_json_dict(getattr(memory, "grounding_json", "{}")),
        quality_score=getattr(memory, "quality_score", 0) or 0,
        generator=getattr(memory, "generator", "local") or "local",
        latency_ms=getattr(memory, "latency_ms", 0) or 0,
        created_at=memory.created_at.isoformat() if memory.created_at else "",
    )


@router.get("/memories", response_model=list[MemoryOut])
def list_memories(session_id: str = "default", limit: int = 12, session: Session = Depends(get_session)) -> list[MemoryOut]:
    limit = max(1, min(limit, 50))
    memories = session.scalars(
        select(AiMemory)
        .where(AiMemory.session_id == session_id)
        .order_by(AiMemory.created_at.desc(), AiMemory.id.desc())
        .limit(limit)
    )
    return [memory_out(memory) for memory in memories]


@router.delete("/memories")
def clear_memories(session_id: str = "default", session: Session = Depends(get_session)) -> dict[str, int]:
    memories = list(session.scalars(select(AiMemory).where(AiMemory.session_id == session_id)))
    count = len(memories)
    for memory in memories:
        session.delete(memory)
    session.commit()
    return {"deleted": count}


@router.get("/scopes")
def public_retrieval_scopes(session: Session = Depends(get_session)) -> dict[str, list[dict]]:
    columns = session.scalars(select(KnowledgeColumn).where(
        KnowledgeColumn.visibility == "public",
        KnowledgeColumn.allow_ai_search.is_(True),
    ).order_by(KnowledgeColumn.sort_order, KnowledgeColumn.name))
    nodes = session.scalars(select(KnowledgeNode).where(
        KnowledgeNode.visibility == "public",
        KnowledgeNode.allow_ai_search.is_(True),
    ).order_by(KnowledgeNode.importance.desc(), KnowledgeNode.title))
    articles = session.scalars(select(Article).where(
        Article.status == "published",
        Article.visibility == "public",
        Article.allow_ai_search.is_(True),
    ).order_by(Article.published_at.desc(), Article.title))
    documents = session.scalars(select(Document).where(
        Document.status == "ready",
        Document.visibility == "public",
        Document.allow_ai_search.is_(True),
    ).order_by(Document.updated_at.desc(), Document.title))
    return {
        "columns": [{"id": item.id, "title": item.name, "slug": item.slug} for item in columns],
        "nodes": [{"id": item.id, "title": item.title, "slug": item.slug} for item in nodes],
        "articles": [{"id": item.id, "title": item.title, "slug": item.slug} for item in articles],
        "documents": [{"id": item.id, "title": item.title, "slug": item.slug} for item in documents],
    }


@router.post("/feedback", response_model=AiFeedbackOut)
def create_feedback(payload: AiFeedbackIn, session: Session = Depends(get_session)) -> AiFeedbackOut:
    rating = payload.rating.strip().lower()
    if rating not in {"useful", "not_useful"}:
        raise HTTPException(status_code=400, detail="rating must be useful or not_useful")

    memory = session.get(AiMemory, payload.memory_id) if payload.memory_id else None
    feedback = AiFeedback(
        memory_id=memory.id if memory else None,
        session_id=payload.session_id or (memory.session_id if memory else "default"),
        rating=rating,
        reason=payload.reason.strip()[:120],
        note=payload.note.strip(),
        question=memory.question if memory else "",
        answer=memory.answer if memory else "",
        source_slugs=memory.source_slugs if memory else "[]",
    )
    session.add(feedback)
    session.commit()
    session.refresh(feedback)
    return AiFeedbackOut(
        id=feedback.id,
        memory_id=feedback.memory_id,
        session_id=feedback.session_id,
        rating=feedback.rating,
        reason=feedback.reason,
        note=feedback.note,
        question=feedback.question,
        created_at=feedback.created_at.isoformat() if feedback.created_at else "",
    )


@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest, session: Session = Depends(get_session)) -> AskResponse:
    started_at = time.perf_counter()
    scope_filter = RetrievalScopeFilter(session, payload.scope)
    scope_payload = scope_filter.payload()
    query_plan = build_query_plan(
        payload.question,
        max_queries=settings.rag_multi_query_limit,
        provider=settings.rag_query_expansion,
    )
    ranked = search_entries(session, payload.question, limit=payload.limit, scope_filter=scope_filter)
    node_ranked = search_knowledge_nodes(session, payload.question, limit=payload.limit, scope_filter=scope_filter)
    document_ranked = search_document_chunks(session, payload.question, limit=payload.limit, scope_filter=scope_filter)
    memories = [
        f"Q: {memory.question}\nA: {memory.answer}"
        for memory in session.scalars(
            select(AiMemory)
            .where(AiMemory.session_id == payload.session_id)
            .order_by(AiMemory.created_at.desc(), AiMemory.id.desc())
            .limit(5)
        )
    ]
    embedding_meta = embedding_status()
    trace = [
        "Receive question",
        "Load recent long-term memory",
        f"Expand query into {len(query_plan.queries)} retrieval variants",
        f"Create query embedding via {embedding_meta['active_provider']} / {embedding_meta['model']}",
        "Hybrid retrieval over persisted content chunks and standardized knowledge nodes",
        f"Apply retrieval scope to {len(scope_filter.article_ids)} articles, {len(scope_filter.node_ids)} nodes and {len(scope_filter.document_ids)} documents",
        "Retrieve enabled chunks from public document knowledge base",
        "Expand matched nodes through public one-hop knowledge relations",
        f"Rank {len(ranked)} content, {len(node_ranked)} knowledge-node and {len(document_ranked)} document candidates",
        "Attach chunk-level and node-level citations with source links",
        "Build grounded prompt",
        "Generate answer with configured LLM or local fallback",
    ]
    source_candidates = []
    for item in ranked:
        raw_context = source_context(item)
        compressed_context = compress_context(payload.question, raw_context, settings.rag_context_max_chars)
        compressed_chunk = compress_context(
            payload.question,
            item.chunk_text or raw_context,
            settings.rag_context_max_chars,
        )
        source_candidates.append(AskSource(
            entity_type=item.entry.entity_type,
            slug=item.entry.slug,
            title=item.entry.title,
            summary=item.entry.summary,
            category=item.entry.category,
            score=round(item.score, 4),
            retrieval_score=round(item.retrieval_score, 4),
            context=compressed_context.text,
            url=source_url(item.entry),
            chunk_index=item.chunk_index,
            matched_chunk=compressed_chunk.text,
            lexical_score=item.lexical_score,
            vector_score=round(item.vector_score, 4),
            rerank_score=round(item.rerank_score, 4),
            rerank_reasons=item.rerank_reasons or [],
            fusion_score=round(item.fusion_score, 6),
            matched_queries=item.matched_queries or [],
            original_chars=max(compressed_context.original_chars, compressed_chunk.original_chars),
            compressed_chars=max(compressed_context.compressed_chars, compressed_chunk.compressed_chars),
            retrieval_store=item.retrieval_store,
        ))
    for hit in node_ranked:
        compressed = compress_context(payload.question, hit.payload["context"], settings.rag_context_max_chars)
        source_candidates.append(AskSource(
            node_id=hit.node.id,
            entity_type="knowledge_node",
            slug=hit.node.slug,
            title=hit.node.title,
            summary=hit.node.summary,
            category=hit.payload["category"],
            score=round(hit.score, 4),
            retrieval_score=round(hit.score, 4),
            context=compressed.text,
            url=hit.payload["url"],
            matched_chunk=compressed.text,
            lexical_score=hit.lexical_score,
            vector_score=round(hit.vector_score, 4),
            rerank_reasons=["标准化知识节点", *hit.payload["graph_relations"][:2]],
            original_chars=compressed.original_chars,
            compressed_chars=compressed.compressed_chars,
            retrieval_store=hit.retrieval_store,
            node_type=hit.payload["node_type"],
            tags=hit.payload["tags"],
            columns=hit.payload["columns"],
            graph_relations=hit.payload["graph_relations"],
            related_node_slugs=hit.payload["related_node_slugs"],
        ))
    for hit in document_ranked:
        compressed = compress_context(payload.question, hit.payload["context"], settings.rag_context_max_chars)
        source_candidates.append(AskSource(
            document_id=hit.document.id,
            document_chunk_id=hit.chunk.id,
            entity_type="document",
            slug=hit.document.slug,
            title=hit.document.title,
            summary=hit.document.summary,
            category=hit.payload["category"],
            score=round(hit.score, 4),
            retrieval_score=round(hit.retrieval_score, 4),
            context=compressed.text,
            url=hit.payload["url"],
            chunk_index=hit.chunk.chunk_index,
            matched_chunk=compressed.text,
            lexical_score=hit.lexical_score,
            vector_score=round(hit.vector_score, 4),
            rerank_score=round(hit.rerank_score, 4),
            rerank_reasons=["文档切片", *hit.rerank_reasons],
            original_chars=compressed.original_chars,
            compressed_chars=compressed.compressed_chars,
            retrieval_store=hit.retrieval_store,
            columns=hit.payload["columns"],
            related_node_slugs=hit.payload["related_node_slugs"],
            page_start=hit.chunk.page_start,
            page_end=hit.chunk.page_end,
        ))

    node_keys = {
        normalized_source_key(value)
        for source in source_candidates
        if source.entity_type == "knowledge_node"
        for value in (source.slug, source.title)
        if value
    }
    source_candidates = [
        source for source in source_candidates
        if not (
            source.entity_type == "knowledge"
            and any(normalized_source_key(value) in node_keys for value in (source.slug, source.title) if value)
        )
    ]
    source_candidates.sort(key=lambda source: (source.score, source.entity_type in {"knowledge_node", "document"}), reverse=True)
    sources = source_candidates[: max(1, min(payload.limit, 10))]
    if node_ranked and not any(source.entity_type == "knowledge_node" for source in sources):
        best_node = next(source for source in source_candidates if source.entity_type == "knowledge_node")
        sources = [*sources[:-1], best_node] if sources else [best_node]
    source_dicts = [source.model_dump() for source in sources]
    evidence = evaluate_evidence(payload.question, source_dicts, settings.rag_evidence_threshold)
    trace.append(
        f"Compress source context to at most {settings.rag_context_max_chars} characters per source"
    )
    trace.append(
        f"Use {sum(source.entity_type == 'knowledge_node' for source in sources)} standardized node citations and their graph context"
    )
    trace.append(f"Use {sum(source.entity_type == 'document' for source in sources)} document chunk citations")
    trace.append(f"Grounding guard: {evidence.status} ({evidence.confidence})")
    prompt_context = "\n".join(
        [f"Question: {payload.question}", f"Retrieval queries: {' | '.join(query_plan.queries)}", f"Scope: {json.dumps(scope_payload, ensure_ascii=False)}", "", "Sources:"]
        + [
            "\n".join(
                [
                    f"{index + 1}. [{source.entity_type}] {source.title}",
                    f"Score: {source.score}",
                    f"Retrieval score: {source.retrieval_score}",
                    f"Rerank score: {source.rerank_score}",
                    f"Fusion score: {source.fusion_score}",
                    f"Matched queries: {' | '.join(source.matched_queries)}",
                    f"Lexical: {source.lexical_score}",
                    f"Vector: {source.vector_score}",
                    f"Retrieval: {source.retrieval_store}",
                    f"URL: {source.url}",
                    f"Chunk: {source.chunk_index if source.chunk_index is not None else '-'}",
                    f"Page: {source.page_start if source.page_start is not None else '-'}",
                    f"Summary: {source.summary}",
                    f"Matched: {source.matched_chunk or source.context}",
                    f"Context: {source.context}",
                    f"Graph relations: {' | '.join(source.graph_relations) or '-'}",
                    f"Related node slugs: {' | '.join(source.related_node_slugs) or '-'}",
                ]
            )
            for index, source in enumerate(sources)
        ]
    )

    if evidence.status == "insufficient":
        answer = (
            "当前已发布的站内内容不足以可靠回答这个问题。"
            f"原因：{evidence.reason}。你可以换一个更具体的问题，或先在知识库和文章中补充相关资料。"
        )
        used_generator = "guardrail"
        verification = verify_answer("", source_dicts, settings.rag_claim_support_threshold)
    else:
        messages = build_grounded_prompt(payload.question, prompt_context, memories)
        llm_answer, generator = call_openai_compatible(messages)
        answer = llm_answer or local_grounded_answer(payload.question, source_dicts, memories)
        used_generator = generator if llm_answer else "local"
        verification = verify_answer(answer, source_dicts, settings.rag_claim_support_threshold)
        if used_generator not in {"local", "guardrail"} and (
            verification.support_score < settings.rag_min_answer_support
            or verification.invalid_citations
        ):
            answer = local_grounded_answer(payload.question, source_dicts, memories)
            used_generator = "grounding-fallback"
            verification = verify_answer(answer, source_dicts, settings.rag_claim_support_threshold)
            trace.append("Replace unsupported or invalidly cited model answer with grounded local fallback")
    grounding = grounding_payload(evidence, verification)
    trace.append(
        f"Verify answer claims: {verification.supported_claims}/{verification.total_claims} supported"
    )
    quality_score = round(
        citation_quality(sources) * 0.6 + verification.support_score * 0.4,
        2,
    ) if evidence.status == "grounded" else 0
    latency_ms = max(1, round((time.perf_counter() - started_at) * 1000))

    memory = AiMemory(
        session_id=payload.session_id,
        question=payload.question,
        answer=answer,
        source_slugs=json.dumps([source.slug for source in sources], ensure_ascii=False),
        sources_json=json.dumps(source_dicts, ensure_ascii=False),
        trace_json=json.dumps(trace, ensure_ascii=False),
        prompt_context=prompt_context,
        query_plan_json=json.dumps({**query_plan_payload(query_plan), "scope": scope_payload}, ensure_ascii=False),
        grounding_json=json.dumps(grounding, ensure_ascii=False),
        quality_score=quality_score,
        generator=used_generator,
        latency_ms=latency_ms,
    )
    session.add(memory)
    session.commit()
    session.refresh(memory)

    return AskResponse(
        answer=answer,
        sources=sources,
        trace=trace,
        prompt_context=prompt_context,
        memory_id=memory.id,
        generator=used_generator,
        quality_score=quality_score,
        latency_ms=latency_ms,
        query_plan={**query_plan_payload(query_plan), "scope": scope_payload},
        grounding=grounding,
        scope=scope_payload,
    )
