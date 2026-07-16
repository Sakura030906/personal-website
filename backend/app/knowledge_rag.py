from dataclasses import dataclass
import hashlib
import json

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .config import settings
from .embeddings import embed_texts, embedding
from .knowledge_service import node_dict
from .models import Article, KnowledgeNode, KnowledgeNodeChunk, KnowledgeRelation
from .reranker import query_features
from .retrieval_scope import RetrievalScopeFilter
from .search_utils import parse_embedding
from .vector_store import (
    delete_node_vectors,
    reset_node_vector_store,
    search_node_vector_store,
    upsert_node_chunks,
)


@dataclass
class KnowledgeNodeHit:
    node: KnowledgeNode
    payload: dict
    score: float
    lexical_score: int
    vector_score: float
    retrieval_store: str = "knowledge_nodes"


def _tokens(value: str) -> list[str]:
    return query_features(value)


def _cosine(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right)) if len(left) == len(right) else 0.0


def _lexical_score(query: str, title: str, text: str) -> int:
    query_text = (query or "").strip().lower()
    title_text = (title or "").lower()
    body = (text or "").lower()
    score = 12 if query_text and query_text in title_text else 8 if query_text and query_text in body else 0
    for token in _tokens(query):
        if token in title_text:
            score += 6
        elif token in body:
            score += 3
    return score


def _chunk_text(value: str, max_chars: int = 760, overlap: int = 140) -> list[str]:
    text = " ".join((value or "").split())
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


def public_knowledge_node_payload(session: Session, node: KnowledgeNode) -> dict:
    payload = node_dict(session, node, include_relations=True)
    relations = []
    relation_lines = []
    related_slugs = []
    for relation in payload.get("relations", []):
        other = relation.get("other_node") or {}
        if not relation.get("is_active") or not relation.get("is_public"):
            continue
        if other.get("visibility") != "public":
            continue
        other_node = session.get(KnowledgeNode, other.get("id")) if other.get("id") else None
        if not other_node or not other_node.allow_ai_search:
            continue
        label = relation.get("relation_label") or relation.get("relation_type") or "相关"
        direction = "指向" if relation.get("perspective") == "outgoing" else "来自"
        line = f"{node.title} {direction} {other.get('title', '')}（{label}）"
        relations.append(relation)
        relation_lines.append(line)
        if other.get("slug"):
            related_slugs.append(other["slug"])

    article_ids = [article.get("id") for article in payload.get("articles", []) if article.get("id")]
    searchable_article_ids = set(session.scalars(select(Article.id).where(
        Article.id.in_(article_ids),
        Article.status == "published",
        Article.visibility == "public",
        Article.allow_ai_search.is_(True),
    ))) if article_ids else set()
    articles = [article for article in payload.get("articles", []) if article.get("id") in searchable_article_ids]
    columns = payload.get("columns", [])
    tags = payload.get("tag_names", [])
    context_parts = [
        node.summary,
        node.content_markdown,
        f"所属专栏：{', '.join(column.get('name', '') for column in columns)}" if columns else "",
        f"标签：{', '.join(tags)}" if tags else "",
        *[f"知识关系：{line}" for line in relation_lines],
        *[f"相关文章：{article.get('title', '')}" for article in articles],
    ]
    return {
        "node_id": node.id,
        "entity_type": "knowledge_node",
        "slug": node.slug,
        "title": node.title,
        "summary": node.summary,
        "category": columns[0]["name"] if columns else "知识节点",
        "node_type": node.node_type,
        "importance": node.importance,
        "tags": tags,
        "columns": [column.get("name", "") for column in columns],
        "relations": relations,
        "graph_relations": relation_lines,
        "related_node_slugs": list(dict.fromkeys(related_slugs)),
        "articles": articles,
        "content": node.content_markdown,
        "context": "\n".join(part for part in context_parts if part),
        "url": f"#node-{node.slug}",
        "updated_at": node.updated_at.isoformat() if node.updated_at else "",
    }


def delete_knowledge_node_index(session: Session, node_id: int) -> int:
    delete_node_vectors(node_id)
    chunks = list(session.scalars(select(KnowledgeNodeChunk).where(KnowledgeNodeChunk.node_id == node_id)))
    for chunk in chunks:
        session.delete(chunk)
    session.flush()
    return len(chunks)


def index_knowledge_node(session: Session, node: KnowledgeNode) -> int:
    delete_knowledge_node_index(session, node.id)
    if node.visibility != "public" or not node.allow_ai_search:
        return 0
    payload = public_knowledge_node_payload(session, node)
    source = "\n\n".join([
        f"Type: knowledge_node",
        f"Title: {node.title}",
        f"Node type: {node.node_type}",
        f"Columns: {', '.join(payload['columns'])}",
        f"Tags: {', '.join(payload['tags'])}",
        node.summary,
        node.content_markdown,
        *[f"Graph relation: {relation}" for relation in payload["graph_relations"]],
        *[f"Related article: {article.get('title', '')}" for article in payload["articles"]],
    ])
    contents = _chunk_text(source)
    embeddings = embed_texts(contents)
    created = []
    for index, content in enumerate(contents):
        result = embeddings[index]
        chunk = KnowledgeNodeChunk(
            node_id=node.id,
            slug=node.slug,
            title=node.title,
            chunk_index=index,
            content=content,
            embedding_json=json.dumps(result.vector, ensure_ascii=False),
            embedding_provider=result.provider,
            embedding_model=result.model,
            embedding_dimensions=result.dimensions,
            token_count=len(_tokens(content)),
            content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
        )
        session.add(chunk)
        created.append(chunk)
    session.flush()
    vector_result = upsert_node_chunks(created)
    if settings.vector_store.strip().lower() == "milvus" and vector_result.get("status") != "ok":
        raise RuntimeError(f"Milvus node upsert failed: {vector_result.get('error') or vector_result.get('status')}")
    return len(created)


def rebuild_knowledge_node_index(session: Session) -> dict[str, int]:
    reset_result = reset_node_vector_store()
    if settings.vector_store.strip().lower() == "milvus" and reset_result.get("status") != "ok":
        raise RuntimeError(f"Milvus node reset failed: {reset_result.get('error') or reset_result.get('status')}")
    for chunk in session.scalars(select(KnowledgeNodeChunk)):
        session.delete(chunk)
    session.flush()
    nodes = list(session.scalars(select(KnowledgeNode).order_by(KnowledgeNode.id)))
    indexed_nodes = 0
    chunk_count = 0
    for node in nodes:
        created = index_knowledge_node(session, node)
        if created:
            indexed_nodes += 1
            chunk_count += created
    session.commit()
    return {"nodes": indexed_nodes, "node_chunks": chunk_count}


def knowledge_node_index_status(session: Session) -> dict:
    chunks = list(session.scalars(select(KnowledgeNodeChunk).order_by(KnowledgeNodeChunk.updated_at.desc())))
    return {
        "indexed_nodes": len({chunk.node_id for chunk in chunks}),
        "node_chunks": len(chunks),
        "last_indexed": chunks[0].updated_at.isoformat() if chunks and chunks[0].updated_at else "",
        "recent_chunks": chunks[:12],
    }


def search_knowledge_nodes(
    session: Session,
    query: str,
    limit: int = 5,
    scope_filter: RetrievalScopeFilter | None = None,
) -> list[KnowledgeNodeHit]:
    limit = max(1, min(limit, 10))
    nodes = [node for node in session.scalars(
        select(KnowledgeNode).where(
            KnowledgeNode.visibility == "public",
            KnowledgeNode.allow_ai_search.is_(True),
        )
    ) if scope_filter is None or scope_filter.allows_node(node)]
    if not nodes or not query.strip():
        return []

    query_vector = embedding(query)
    candidates: dict[int, KnowledgeNodeHit] = {}
    chunks = list(session.scalars(select(KnowledgeNodeChunk)))
    indexed_node_ids = {chunk.node_id for chunk in chunks}
    milvus_hits = search_node_vector_store(query_vector, limit=max(limit * settings.rag_milvus_expand, limit))
    milvus_scores = {hit.chunk_id: hit.score for hit in milvus_hits}
    if milvus_hits:
        chunks_by_id = {chunk.id: chunk for chunk in chunks}
        chunks = [chunks_by_id[hit.chunk_id] for hit in milvus_hits if hit.chunk_id in chunks_by_id]

    node_by_id = {node.id: node for node in nodes}
    for chunk in chunks:
        node = node_by_id.get(chunk.node_id)
        if not node:
            continue
        lexical = _lexical_score(query, node.title, chunk.content)
        chunk_vector = parse_embedding(chunk.embedding_json)
        vector = milvus_scores.get(chunk.id, _cosine(query_vector, chunk_vector)) if chunk_vector else 0.0
        score = lexical * settings.rag_lexical_weight + vector * settings.rag_vector_weight
        current = candidates.get(node.id)
        if lexical > 0 or score > settings.rag_min_score:
            if current is None or score > current.score:
                candidates[node.id] = KnowledgeNodeHit(
                    node=node,
                    payload=public_knowledge_node_payload(session, node),
                    score=score,
                    lexical_score=lexical,
                    vector_score=vector,
                    retrieval_store="milvus_knowledge_nodes" if milvus_hits else "knowledge_node_chunks",
                )

    for node in nodes:
        if node.id in candidates or node.id in indexed_node_ids:
            continue
        payload = public_knowledge_node_payload(session, node)
        text = "\n".join([
            node.title,
            node.summary,
            node.content_markdown,
            " ".join(payload["tags"]),
            " ".join(payload["columns"]),
        ])
        lexical = _lexical_score(query, node.title, text)
        vector = _cosine(query_vector, embedding(text))
        score = lexical * settings.rag_lexical_weight + vector * settings.rag_entry_vector_weight
        if lexical > 0 or score > settings.rag_min_score:
            candidates[node.id] = KnowledgeNodeHit(node, payload, score, lexical, vector)

    direct = sorted(candidates.values(), key=lambda hit: (hit.score, hit.node.importance), reverse=True)
    seed_ids = {hit.node.id for hit in direct[: min(3, limit)]}
    if seed_ids and (scope_filter is None or scope_filter.scope.include_graph_neighbors):
        relations = list(session.scalars(select(KnowledgeRelation).where(
            KnowledgeRelation.is_active.is_(True),
            KnowledgeRelation.is_public.is_(True),
            or_(KnowledgeRelation.source_node_id.in_(seed_ids), KnowledgeRelation.target_node_id.in_(seed_ids)),
        )))
        node_by_id = {node.id: node for node in nodes}
        for relation in relations:
            seed_id = relation.source_node_id if relation.source_node_id in seed_ids else relation.target_node_id
            neighbor_id = relation.target_node_id if seed_id == relation.source_node_id else relation.source_node_id
            if neighbor_id in candidates or neighbor_id not in node_by_id:
                continue
            seed = candidates.get(seed_id)
            if not seed:
                continue
            node = node_by_id[neighbor_id]
            payload = public_knowledge_node_payload(session, node)
            payload["graph_relations"] = list(dict.fromkeys([
                *payload["graph_relations"],
                f"由 {seed.node.title} 通过 {relation.relation_label or relation.relation_type} 关系扩展召回",
            ]))
            candidates[neighbor_id] = KnowledgeNodeHit(
                node=node,
                payload=payload,
                score=seed.score * 0.55 * max(0.5, relation.weight),
                lexical_score=0,
                vector_score=0,
                retrieval_store="knowledge_graph",
            )

    return sorted(candidates.values(), key=lambda hit: (hit.score, hit.node.importance), reverse=True)[:limit]


def get_public_knowledge_node(session: Session, slug: str) -> dict | None:
    node = session.scalar(select(KnowledgeNode).where(
        KnowledgeNode.slug == slug,
        KnowledgeNode.visibility == "public",
        KnowledgeNode.allow_ai_search.is_(True),
    ))
    return public_knowledge_node_payload(session, node) if node else None
