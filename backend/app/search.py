from dataclasses import dataclass, replace
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .embeddings import embed_text, embed_texts, embedding
from .models import ContentChunk, ContentEntry
from .query_expansion import build_query_plan
from .reranker import query_features, score_candidate
from .retrieval_scope import RetrievalScopeFilter
from .search_utils import parse_embedding
from .vector_store import delete_entry_vectors, reset_vector_store, search_vector_store, upsert_chunks

# Knowledge is indexed exclusively from the normalized KnowledgeNode tables.
# The legacy `knowledge` ContentEntry type is intentionally excluded.
INDEXED_ENTITY_TYPES = {"post", "project", "reading"}


@dataclass
class RankedEntry:
    entry: ContentEntry
    score: float
    retrieval_score: float = 0.0
    lexical_score: int = 0
    vector_score: float = 0.0
    rerank_score: float = 0.0
    rerank_reasons: list[str] | None = None
    fusion_score: float = 0.0
    matched_queries: list[str] | None = None
    chunk_text: str = ""
    chunk_index: int | None = None
    retrieval_store: str = "local"


@dataclass
class SearchTuning:
    lexical_weight: float
    vector_weight: float
    entry_vector_weight: float
    min_score: float
    milvus_expand: int
    reranker: str
    rerank_top_k: int
    rerank_weight: float
    query_expansion: str
    multi_query_limit: int
    fusion_k: int
    fusion_weight: float
    name: str = "default"


def default_tuning() -> SearchTuning:
    return SearchTuning(
        lexical_weight=settings.rag_lexical_weight,
        vector_weight=settings.rag_vector_weight,
        entry_vector_weight=settings.rag_entry_vector_weight,
        min_score=settings.rag_min_score,
        milvus_expand=settings.rag_milvus_expand,
        reranker=settings.rag_reranker,
        rerank_top_k=settings.rag_rerank_top_k,
        rerank_weight=settings.rag_rerank_weight,
        query_expansion=settings.rag_query_expansion,
        multi_query_limit=settings.rag_multi_query_limit,
        fusion_k=settings.rag_fusion_k,
        fusion_weight=settings.rag_fusion_weight,
    )


def tuning_from_payload(payload: dict | None = None) -> SearchTuning:
    payload = payload or {}
    base = default_tuning()
    return SearchTuning(
        name=str(payload.get("name") or base.name),
        lexical_weight=float(payload.get("lexical_weight", base.lexical_weight)),
        vector_weight=float(payload.get("vector_weight", base.vector_weight)),
        entry_vector_weight=float(payload.get("entry_vector_weight", base.entry_vector_weight)),
        min_score=float(payload.get("min_score", base.min_score)),
        milvus_expand=max(1, int(payload.get("milvus_expand", base.milvus_expand))),
        reranker=str(payload.get("reranker", base.reranker)).lower(),
        rerank_top_k=max(1, int(payload.get("rerank_top_k", base.rerank_top_k))),
        rerank_weight=max(0.0, float(payload.get("rerank_weight", base.rerank_weight))),
        query_expansion=str(payload.get("query_expansion", base.query_expansion)).lower(),
        multi_query_limit=max(1, int(payload.get("multi_query_limit", base.multi_query_limit))),
        fusion_k=max(1, int(payload.get("fusion_k", base.fusion_k))),
        fusion_weight=max(0.0, float(payload.get("fusion_weight", base.fusion_weight))),
    )


def tuning_payload(tuning: SearchTuning) -> dict[str, float | int | str]:
    return {
        "name": tuning.name,
        "lexical_weight": tuning.lexical_weight,
        "vector_weight": tuning.vector_weight,
        "entry_vector_weight": tuning.entry_vector_weight,
        "min_score": tuning.min_score,
        "milvus_expand": tuning.milvus_expand,
        "reranker": tuning.reranker,
        "rerank_top_k": tuning.rerank_top_k,
        "rerank_weight": tuning.rerank_weight,
        "query_expansion": tuning.query_expansion,
        "multi_query_limit": tuning.multi_query_limit,
        "fusion_k": tuning.fusion_k,
        "fusion_weight": tuning.fusion_weight,
    }


def rerank_entries(query: str, ranked: list[RankedEntry], tuning: SearchTuning, limit: int) -> list[RankedEntry]:
    candidates = sorted(ranked, key=lambda current: current.score, reverse=True)[: max(limit, tuning.rerank_top_k)]
    if tuning.reranker in {"", "off", "none", "disabled"} or tuning.rerank_weight <= 0:
        for item in candidates:
            item.retrieval_score = item.score
        return candidates[:limit]

    for item in candidates:
        item.retrieval_score = item.score
        result = score_candidate(
            query,
            item.entry.title,
            item.entry.summary,
            item.chunk_text or item.entry.content_md,
        )
        item.rerank_score = result.score
        item.rerank_reasons = result.reasons
        item.score = item.retrieval_score + result.score * tuning.rerank_weight
    return sorted(candidates, key=lambda current: (current.score, current.retrieval_score), reverse=True)[:limit]


def tokenize(value: str) -> list[str]:
    return query_features(value)


def entry_text(entry: ContentEntry) -> str:
    return " ".join(
        [
            entry.entity_type,
            entry.slug,
            entry.title,
            entry.summary,
            entry.category,
            entry.content_md,
            entry.metadata_json,
        ]
    ).lower()


def normalize_text(value: str) -> str:
    return " ".join((value or "").split())


def score_entry(entry: ContentEntry, query: str) -> int:
    text = entry_text(entry)
    normalized_query = query.lower().strip()
    score = 10 if normalized_query and normalized_query in text else 0
    for token in tokenize(query):
        if token in text:
            score += 3
        if token in entry.title.lower():
            score += 5
    return score


def score_text(value: str, query: str, title: str = "") -> int:
    text = value.lower()
    title_text = title.lower()
    normalized_query = query.lower().strip()
    score = 10 if normalized_query and normalized_query in text else 0
    for token in tokenize(query):
        if token in text:
            score += 3
        if token in title_text:
            score += 5
    return score


def cosine(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def chunk_text(value: str, max_chars: int = 760, overlap: int = 140) -> list[str]:
    text = normalize_text(value)
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start = max(0, end - overlap)
    return [chunk for chunk in chunks if chunk]


def entry_chunks(entry: ContentEntry) -> list[str]:
    try:
        metadata = json.loads(entry.metadata_json or "{}")
    except json.JSONDecodeError:
        metadata = {}
    metadata_text = ""
    if isinstance(metadata, dict):
        values = []
        for key in [
            "tags",
            "items",
            "stack",
            "relatedProjects",
            "relatedKnowledge",
            "relatedPosts",
            "relatedReading",
            "noteLinks",
        ]:
            current = metadata.get(key)
            if isinstance(current, list):
                values.extend(str(item) for item in current)
            elif current:
                values.append(str(current))
        metadata_text = " ".join(values)

    source = "\n\n".join(
        [
            f"Type: {entry.entity_type}",
            f"Title: {entry.title}",
            f"Category: {entry.category}",
            f"Summary: {entry.summary}",
            metadata_text,
            entry.content_md or "",
        ]
    )
    chunks = chunk_text(source)
    if not chunks and normalize_text(entry_text(entry)):
        chunks = [normalize_text(entry_text(entry))[:760]]
    return chunks


def delete_content_entry_index(session: Session, entry_id: int) -> int:
    delete_entry_vectors(entry_id)
    chunks = list(session.scalars(select(ContentChunk).where(ContentChunk.entry_id == entry_id)))
    for chunk in chunks:
        session.delete(chunk)
    session.flush()
    return len(chunks)


def index_content_entry(session: Session, entry: ContentEntry) -> int:
    delete_content_entry_index(session, entry.id)
    if entry.entity_type not in INDEXED_ENTITY_TYPES:
        return 0

    chunks = entry_chunks(entry)
    created_chunks = []
    batch_size = max(1, settings.embedding_batch_size)
    embeddings = []
    for start in range(0, len(chunks), batch_size):
        embeddings.extend(embed_texts(chunks[start : start + batch_size]))

    for index, content in enumerate(chunks):
        current_embedding = embeddings[index]
        chunk = ContentChunk(
            entry_id=entry.id,
            entity_type=entry.entity_type,
            slug=entry.slug,
            title=entry.title,
            chunk_index=index,
            content=content,
            embedding_json=json.dumps(current_embedding.vector, ensure_ascii=False),
            embedding_provider=current_embedding.provider,
            embedding_model=current_embedding.model,
            embedding_dimensions=current_embedding.dimensions,
            token_count=len(tokenize(content)),
            content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
        )
        session.add(chunk)
        created_chunks.append(chunk)
    session.flush()
    vector_result = upsert_chunks(created_chunks)
    if settings.vector_store.strip().lower() == "milvus" and vector_result.get("status") != "ok":
        raise RuntimeError(f"Milvus content upsert failed: {vector_result.get('error') or vector_result.get('status')}")
    return len(chunks)


def rebuild_vector_index(session: Session) -> dict[str, int]:
    reset_result = reset_vector_store()
    if settings.vector_store.strip().lower() == "milvus" and reset_result.get("status") != "ok":
        raise RuntimeError(f"Milvus content reset failed: {reset_result.get('error') or reset_result.get('status')}")
    existing = list(session.scalars(select(ContentChunk)))
    for chunk in existing:
        session.delete(chunk)
    session.flush()

    entries = list(
        session.scalars(
            select(ContentEntry)
            .where(ContentEntry.entity_type.in_(INDEXED_ENTITY_TYPES))
            .order_by(ContentEntry.updated_at.desc())
        )
    )
    chunk_count = 0
    indexed_entries = 0
    for entry in entries:
        created_chunks = index_content_entry(session, entry)
        if not created_chunks:
            continue
        indexed_entries += 1
        chunk_count += created_chunks
    session.commit()
    return {"entries": indexed_entries, "chunks": chunk_count}


def rank_chunks(
    session: Session,
    query: str,
    chunks: list[ContentChunk],
    query_vector: list[float],
    limit: int,
    published_only: bool,
    vector_scores: dict[int, float] | None = None,
    retrieval_store: str = "local_chunks",
    tuning: SearchTuning | None = None,
    scope_filter: RetrievalScopeFilter | None = None,
) -> list[RankedEntry]:
    tuning = tuning or default_tuning()
    if not chunks:
        return []

    entry_ids = {chunk.entry_id for chunk in chunks}
    entries = {
        entry.id: entry
        for entry in session.scalars(select(ContentEntry).where(ContentEntry.id.in_(entry_ids)))
        if (not published_only or entry.status == "published")
        and (scope_filter is None or scope_filter.allows_entry(entry))
    }
    best_by_entry: dict[int, RankedEntry] = {}
    for chunk in chunks:
        entry = entries.get(chunk.entry_id)
        if not entry or entry.entity_type == "site":
            continue
        chunk_vector = parse_embedding(chunk.embedding_json)
        if not chunk_vector:
            continue
        if len(query_vector) != len(chunk_vector):
            vector_score = 0
        else:
            vector_score = vector_scores.get(chunk.id, cosine(query_vector, chunk_vector)) if vector_scores else cosine(query_vector, chunk_vector)
        lexical_score = score_text(chunk.content, query, chunk.title)
        score = lexical_score * tuning.lexical_weight + vector_score * tuning.vector_weight
        if score <= tuning.min_score:
            continue
        current = best_by_entry.get(entry.id)
        if current is None or score > current.score:
            best_by_entry[entry.id] = RankedEntry(
                entry=entry,
                score=score,
                retrieval_score=score,
                lexical_score=lexical_score,
                vector_score=vector_score,
                chunk_text=chunk.content,
                chunk_index=chunk.chunk_index,
                retrieval_store=retrieval_store,
            )
    return rerank_entries(query, list(best_by_entry.values()), tuning, limit)


def search_chunk_entries(
    session: Session,
    query: str,
    limit: int = 10,
    published_only: bool = True,
    tuning: SearchTuning | None = None,
    scope_filter: RetrievalScopeFilter | None = None,
) -> list[RankedEntry]:
    tuning = tuning or default_tuning()
    query_vector = embedding(query)
    milvus_hits = search_vector_store(query_vector, limit=max(limit * tuning.milvus_expand, limit))
    if milvus_hits:
        hit_scores = {hit.chunk_id: hit.score for hit in milvus_hits}
        chunks_by_id = {
            chunk.id: chunk
            for chunk in session.scalars(select(ContentChunk).where(ContentChunk.id.in_(hit_scores.keys())))
        }
        ordered_chunks = [chunks_by_id[hit.chunk_id] for hit in milvus_hits if hit.chunk_id in chunks_by_id]
        ranked = rank_chunks(session, query, ordered_chunks, query_vector, limit, published_only, hit_scores, retrieval_store="milvus", tuning=tuning, scope_filter=scope_filter)
        if ranked:
            return ranked

    chunks = list(session.scalars(select(ContentChunk)))
    return rank_chunks(session, query, chunks, query_vector, limit, published_only, retrieval_store="local_chunks", tuning=tuning, scope_filter=scope_filter)


def search_entries_once(
    session: Session,
    query: str,
    limit: int = 10,
    published_only: bool = True,
    tuning: SearchTuning | None = None,
    scope_filter: RetrievalScopeFilter | None = None,
) -> list[RankedEntry]:
    tuning = tuning or default_tuning()
    chunk_ranked = search_chunk_entries(session, query, limit=limit, published_only=published_only, tuning=tuning, scope_filter=scope_filter)
    if chunk_ranked:
        return chunk_ranked

    statement = select(ContentEntry)
    if published_only:
        statement = statement.where(ContentEntry.status == "published")

    query_embedding = embed_text(query)
    query_vector = query_embedding.vector
    ranked = [
        RankedEntry(
            entry=entry,
            score=score_entry(entry, query) * tuning.lexical_weight + cosine(query_vector, embedding(entry_text(entry))) * tuning.entry_vector_weight,
            lexical_score=score_entry(entry, query),
            vector_score=cosine(query_vector, embedding(entry_text(entry))),
            retrieval_store="entry_fallback",
        )
        for entry in session.scalars(statement)
        if entry.entity_type != "site" and (scope_filter is None or scope_filter.allows_entry(entry))
    ]
    eligible = [item for item in ranked if item.score > tuning.min_score]
    return rerank_entries(query, eligible, tuning, limit)


def search_entries(
    session: Session,
    query: str,
    limit: int = 10,
    published_only: bool = True,
    tuning: SearchTuning | None = None,
    scope_filter: RetrievalScopeFilter | None = None,
) -> list[RankedEntry]:
    tuning = tuning or default_tuning()
    plan = build_query_plan(query, max_queries=tuning.multi_query_limit, provider=tuning.query_expansion)
    if len(plan.queries) <= 1:
        return search_entries_once(session, query, limit=limit, published_only=published_only, tuning=tuning, scope_filter=scope_filter)

    candidate_limit = max(limit, tuning.rerank_top_k)
    fused: dict[int, RankedEntry] = {}
    reciprocal_scores: dict[int, float] = {}
    matched_queries: dict[int, list[str]] = {}
    for current_query in plan.queries:
        ranked = search_entries_once(
            session,
            current_query,
            limit=candidate_limit,
            published_only=published_only,
            tuning=tuning,
            scope_filter=scope_filter,
        )
        for rank, item in enumerate(ranked, start=1):
            entry_id = item.entry.id
            reciprocal_scores[entry_id] = reciprocal_scores.get(entry_id, 0.0) + 1 / (tuning.fusion_k + rank)
            matched_queries.setdefault(entry_id, []).append(current_query)
            if entry_id not in fused or item.score > fused[entry_id].score:
                fused[entry_id] = replace(item)

    candidates = []
    for entry_id, item in fused.items():
        item.fusion_score = round(reciprocal_scores[entry_id], 6)
        item.matched_queries = matched_queries[entry_id]
        item.score += item.fusion_score * tuning.fusion_weight
        item.rerank_score = 0.0
        item.rerank_reasons = []
        candidates.append(item)
    return rerank_entries(plan.original, candidates, tuning, limit)
