from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .embeddings import embedding
from .models import Document, DocumentChunk, DocumentNode, KnowledgeColumn, KnowledgeNode
from .reranker import query_features, score_candidate
from .retrieval_scope import RetrievalScopeFilter
from .search_utils import parse_embedding
from .vector_store import (
    delete_document_vectors, reset_document_vector_store,
    search_document_vector_store, upsert_document_chunks,
)


@dataclass
class DocumentHit:
    document: Document
    chunk: DocumentChunk
    score: float
    retrieval_score: float
    lexical_score: int
    vector_score: float
    rerank_score: float
    rerank_reasons: list[str]
    retrieval_store: str
    payload: dict


def _tokens(value: str) -> list[str]:
    return query_features(value)


def _lexical_score(query: str, title: str, content: str) -> int:
    query_text = query.strip().lower()
    title_text = title.lower()
    body = content.lower()
    score = 12 if query_text and query_text in title_text else 8 if query_text and query_text in body else 0
    for token in _tokens(query):
        if token in title_text:
            score += 6
        elif token in body:
            score += 3
    return score


def _cosine(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right)) if len(left) == len(right) else 0.0


def public_document_payload(session: Session, document: Document, chunk: DocumentChunk) -> dict:
    column = session.get(KnowledgeColumn, document.column_id) if document.column_id else None
    nodes = session.execute(
        select(KnowledgeNode.id, KnowledgeNode.title, KnowledgeNode.slug)
        .join(DocumentNode, DocumentNode.node_id == KnowledgeNode.id)
        .where(
            DocumentNode.document_id == document.id,
            KnowledgeNode.visibility == "public",
            KnowledgeNode.allow_ai_search.is_(True),
        )
        .order_by(KnowledgeNode.title)
    ).all()
    page_suffix = f"#page={chunk.page_start}" if chunk.page_start else ""
    return {
        "document_id": document.id,
        "document_chunk_id": chunk.id,
        "entity_type": "document",
        "slug": document.slug,
        "title": document.title,
        "summary": document.summary,
        "category": column.name if column else "文档",
        "column_id": column.id if column else None,
        "columns": [column.name] if column else [],
        "nodes": [{"id": row.id, "title": row.title, "slug": row.slug} for row in nodes],
        "related_node_slugs": [row.slug for row in nodes],
        "heading": chunk.heading,
        "content": chunk.content,
        "context": "\n".join(part for part in [
            document.summary,
            f"章节：{chunk.heading}" if chunk.heading else "",
            f"页码：{chunk.page_start}" if chunk.page_start else "",
            chunk.content,
            f"关联知识节点：{', '.join(row.title for row in nodes)}" if nodes else "",
        ] if part),
        "url": f"{document.file_url}{page_suffix}",
        "page_start": chunk.page_start,
        "page_end": chunk.page_end,
    }


def sync_document_index(session: Session, document: Document) -> dict[str, object]:
    if document.deleted_at or document.status != "ready" or document.visibility != "public" or not document.allow_ai_search:
        return delete_document_vectors(document.id)
    chunks = list(session.scalars(select(DocumentChunk).where(
        DocumentChunk.document_id == document.id,
        DocumentChunk.is_enabled.is_(True),
    ).order_by(DocumentChunk.chunk_index)))
    if not chunks:
        return delete_document_vectors(document.id)
    return upsert_document_chunks(chunks)


def rebuild_document_index(session: Session) -> dict[str, int]:
    reset_result = reset_document_vector_store()
    if settings.vector_store.strip().lower() == "milvus" and reset_result.get("status") != "ok":
        raise RuntimeError(f"Milvus document reset failed: {reset_result.get('error') or reset_result.get('status')}")
    documents = list(session.scalars(select(Document).where(
        Document.status == "ready",
        Document.visibility == "public",
        Document.allow_ai_search.is_(True),
        Document.deleted_at.is_(None),
    )))
    indexed_documents = 0
    indexed_chunks = 0
    for document in documents:
        result = sync_document_index(session, document)
        if settings.vector_store.strip().lower() == "milvus" and result.get("status") != "ok":
            raise RuntimeError(f"Milvus document upsert failed: {result.get('error') or result.get('status')}")
        chunk_count = session.scalar(select(DocumentChunk.id).where(
            DocumentChunk.document_id == document.id,
            DocumentChunk.is_enabled.is_(True),
        ).limit(1))
        if chunk_count:
            indexed_documents += 1
            indexed_chunks += int(result.get("upserted") or 0) if settings.vector_store.strip().lower() == "milvus" else len(list(session.scalars(select(DocumentChunk.id).where(
                DocumentChunk.document_id == document.id,
                DocumentChunk.is_enabled.is_(True),
            ))))
    return {"documents": indexed_documents, "document_chunks": indexed_chunks}


def search_document_chunks(
    session: Session,
    query: str,
    limit: int = 5,
    scope_filter: RetrievalScopeFilter | None = None,
) -> list[DocumentHit]:
    limit = max(1, min(limit, 10))
    documents = [document for document in session.scalars(select(Document).where(
        Document.status == "ready",
        Document.visibility == "public",
        Document.allow_ai_search.is_(True),
        Document.deleted_at.is_(None),
    )) if scope_filter is None or scope_filter.allows_document(document)]
    if not documents or not query.strip():
        return []
    document_by_id = {document.id: document for document in documents}
    query_vector = embedding(query)
    chunks = list(session.scalars(select(DocumentChunk).where(
        DocumentChunk.document_id.in_(document_by_id),
        DocumentChunk.is_enabled.is_(True),
    )))
    milvus_hits = search_document_vector_store(query_vector, max(limit * settings.rag_milvus_expand, limit))
    milvus_scores = {hit.chunk_id: hit.score for hit in milvus_hits}
    if milvus_hits:
        chunks_by_id = {chunk.id: chunk for chunk in chunks}
        chunks = [chunks_by_id[hit.chunk_id] for hit in milvus_hits if hit.chunk_id in chunks_by_id]

    candidates = []
    for chunk in chunks:
        document = document_by_id.get(chunk.document_id)
        if not document:
            continue
        lexical = _lexical_score(query, f"{document.title} {chunk.heading}", chunk.content)
        chunk_vector = parse_embedding(chunk.embedding_json)
        vector = milvus_scores.get(chunk.id, _cosine(query_vector, chunk_vector)) if chunk_vector else 0.0
        retrieval_score = lexical * settings.rag_lexical_weight + vector * settings.rag_vector_weight
        if lexical <= 0 and retrieval_score <= settings.rag_min_score:
            continue
        reranked = score_candidate(query, f"{document.title} {chunk.heading}", document.summary, chunk.content)
        score = retrieval_score + reranked.score * settings.rag_rerank_weight
        candidates.append(DocumentHit(
            document=document,
            chunk=chunk,
            score=score,
            retrieval_score=retrieval_score,
            lexical_score=lexical,
            vector_score=vector,
            rerank_score=reranked.score,
            rerank_reasons=reranked.reasons,
            retrieval_store="milvus_documents" if milvus_hits else "document_chunks",
            payload=public_document_payload(session, document, chunk),
        ))
    return sorted(candidates, key=lambda hit: (hit.score, hit.retrieval_score), reverse=True)[:limit]
