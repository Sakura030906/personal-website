import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_session
from ..article_service import article_dict
from ..knowledge_service import node_dict
from ..models import Article, ArticleColumn, ContentEntry, KnowledgeColumn, KnowledgeColumnNode, KnowledgeNode, KnowledgeRelation
from ..site_sync import read_site_document

router = APIRouter()


def public_article_payload(session: Session, article: Article) -> dict:
    payload = article_dict(session, article)
    public_nodes = [node for node in payload.get("nodes", []) if node.get("visibility") == "public"]
    payload["nodes"] = public_nodes
    try:
        metadata = json.loads(payload.get("metadata_json") or "{}")
    except json.JSONDecodeError:
        metadata = {}
    metadata["nodes"] = public_nodes
    payload["metadata_json"] = json.dumps(metadata, ensure_ascii=False)
    return payload


def public_entry(entry: ContentEntry) -> dict:
    try:
        metadata = json.loads(entry.metadata_json or "{}")
    except json.JSONDecodeError:
        metadata = {}
    return {
        "id": entry.id,
        "slug": entry.slug,
        "title": entry.title,
        "name": entry.title,
        "topic": entry.title,
        "summary": entry.summary,
        "content": entry.content_md,
        "category": entry.category,
        "status": entry.status,
        "visibility": entry.visibility,
        "revision": entry.revision,
        "published_at": entry.published_at.isoformat() if entry.published_at else "",
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else "",
        **(metadata if isinstance(metadata, dict) else {}),
    }


@router.get("/public")
def public_content(session: Session = Depends(get_session)) -> dict[str, list]:
    entries = session.scalars(
        select(ContentEntry)
        .where(ContentEntry.status == "published", ContentEntry.visibility == "public", ContentEntry.deleted_at.is_(None))
        .order_by(ContentEntry.published_at.desc(), ContentEntry.updated_at.desc())
    )
    grouped: dict[str, object] = {"posts": [], "projects": [], "knowledgeBase": [], "knowledgeColumns": [], "knowledgeNodes": [], "knowledgeGraph": {}}
    for entry in entries:
        item = public_entry(entry)
        if entry.entity_type == "project":
            grouped["projects"].append(item)
        elif entry.entity_type == "knowledge":
            grouped["knowledgeBase"].append(item)
    articles = session.scalars(
        select(Article)
        .where(Article.status == "published", Article.visibility == "public", Article.deleted_at.is_(None))
        .order_by(Article.is_top.desc(), Article.published_at.desc(), Article.updated_at.desc())
    )
    grouped["posts"] = [public_article_payload(session, article) for article in articles]
    grouped["knowledgeColumns"] = public_columns(session=session)
    nodes = session.scalars(
        select(KnowledgeNode).where(KnowledgeNode.visibility == "public", KnowledgeNode.deleted_at.is_(None))
        .order_by(KnowledgeNode.importance.desc(), KnowledgeNode.updated_at.desc(), KnowledgeNode.title)
    )
    grouped["knowledgeNodes"] = [public_node_payload(session, node) for node in nodes]
    grouped["knowledgeGraph"] = public_knowledge_graph(session=session)
    return grouped


@router.get("/articles")
def public_articles(
    limit: int = 20,
    offset: int = 0,
    category: str | None = None,
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    query = select(Article).where(
        Article.status == "published",
        Article.visibility == "public",
        Article.deleted_at.is_(None),
    )
    if category:
        from ..models import Category

        query = query.join(Category, Article.category_id == Category.id).where(Category.name == category)
    query = query.order_by(Article.is_top.desc(), Article.published_at.desc(), Article.updated_at.desc())
    all_entries = list(session.scalars(query))
    return {
        "total": len(all_entries),
        "limit": limit,
        "offset": offset,
        "items": [public_article_payload(session, article) for article in all_entries[offset : offset + limit]],
    }


@router.get("/articles/{slug}")
def public_article(slug: str, session: Session = Depends(get_session)) -> dict:
    article = session.scalar(
        select(Article).where(
            Article.slug == slug,
            Article.status == "published",
            Article.visibility.in_(["public", "unlisted"]),
            Article.deleted_at.is_(None),
        )
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return public_article_payload(session, article)


def column_public_dict(session: Session, column: KnowledgeColumn) -> dict:
    article_count = session.scalar(
        select(func.count())
        .select_from(ArticleColumn)
        .join(Article, Article.id == ArticleColumn.article_id)
        .where(
            ArticleColumn.column_id == column.id,
            Article.status == "published",
            Article.visibility == "public",
            Article.deleted_at.is_(None),
        )
    ) or 0
    node_count = session.scalar(
        select(func.count()).select_from(KnowledgeColumnNode)
        .join(KnowledgeNode, KnowledgeNode.id == KnowledgeColumnNode.node_id)
        .where(KnowledgeColumnNode.column_id == column.id, KnowledgeNode.visibility == "public", KnowledgeNode.deleted_at.is_(None))
    ) or 0
    return {
        "id": column.id,
        "name": column.name,
        "slug": column.slug,
        "description": column.description,
        "cover_url": column.cover_url,
        "icon": column.icon,
        "article_count": article_count,
        "node_count": node_count,
        "updated_at": column.updated_at.isoformat() if column.updated_at else "",
    }


@router.get("/columns")
def public_columns(session: Session = Depends(get_session)) -> list[dict]:
    columns = session.scalars(
        select(KnowledgeColumn)
        .where(KnowledgeColumn.visibility == "public", KnowledgeColumn.deleted_at.is_(None))
        .order_by(KnowledgeColumn.sort_order, KnowledgeColumn.name)
    )
    return [column_public_dict(session, column) for column in columns]


@router.get("/columns/{slug}")
def public_column(slug: str, session: Session = Depends(get_session)) -> dict:
    column = session.scalar(
        select(KnowledgeColumn).where(
            KnowledgeColumn.slug == slug,
            KnowledgeColumn.visibility.in_(["public", "unlisted"]),
            KnowledgeColumn.deleted_at.is_(None),
        )
    )
    if not column:
        raise HTTPException(status_code=404, detail="Knowledge column not found")
    articles = session.scalars(
        select(Article)
        .join(ArticleColumn, ArticleColumn.article_id == Article.id)
        .where(
            ArticleColumn.column_id == column.id,
            Article.status == "published",
            Article.visibility == "public",
            Article.deleted_at.is_(None),
        )
        .order_by(ArticleColumn.is_primary.desc(), ArticleColumn.sort_order, Article.published_at.desc())
    )
    nodes = session.scalars(
        select(KnowledgeNode)
        .join(KnowledgeColumnNode, KnowledgeColumnNode.node_id == KnowledgeNode.id)
        .where(KnowledgeColumnNode.column_id == column.id, KnowledgeNode.visibility == "public", KnowledgeNode.deleted_at.is_(None))
        .order_by(KnowledgeColumnNode.is_primary.desc(), KnowledgeColumnNode.sort_order, KnowledgeNode.title)
    )
    return {
        **column_public_dict(session, column),
        "articles": [public_article_payload(session, article) for article in articles],
        "nodes": [node_dict(session, node, include_relations=False) for node in nodes],
    }


def public_node_payload(session: Session, node: KnowledgeNode, include_relations: bool = True) -> dict:
    payload = node_dict(session, node, include_relations=include_relations)
    payload["articles"] = [article for article in payload["articles"] if article["status"] == "published" and article["visibility"] == "public"]
    if include_relations:
        payload["relations"] = [
            relation for relation in payload.get("relations", [])
            if relation["is_active"] and relation["is_public"]
            and relation.get("other_node") and relation["other_node"]["visibility"] == "public"
        ]
    return payload


@router.get("/nodes")
def public_nodes(
    limit: int = 100,
    offset: int = 0,
    column: str | None = None,
    session: Session = Depends(get_session),
) -> dict[str, object]:
    query = select(KnowledgeNode).where(KnowledgeNode.visibility == "public", KnowledgeNode.deleted_at.is_(None))
    if column:
        query = query.join(KnowledgeColumnNode, KnowledgeColumnNode.node_id == KnowledgeNode.id).join(
            KnowledgeColumn, KnowledgeColumn.id == KnowledgeColumnNode.column_id
        ).where(KnowledgeColumn.slug == column)
    rows = list(session.scalars(query.order_by(KnowledgeNode.importance.desc(), KnowledgeNode.updated_at.desc(), KnowledgeNode.title)))
    return {"total": len(rows), "limit": limit, "offset": offset, "items": [public_node_payload(session, node, False) for node in rows[offset:offset + limit]]}


@router.get("/knowledge-graph")
def public_knowledge_graph(
    column: str | None = None,
    node_type: str | None = None,
    relation_type: str | None = None,
    q: str | None = None,
    session: Session = Depends(get_session),
) -> dict[str, object]:
    query = select(KnowledgeNode).where(KnowledgeNode.visibility == "public", KnowledgeNode.deleted_at.is_(None))
    if column:
        query = query.join(KnowledgeColumnNode, KnowledgeColumnNode.node_id == KnowledgeNode.id).join(
            KnowledgeColumn, KnowledgeColumn.id == KnowledgeColumnNode.column_id
        ).where(KnowledgeColumn.slug == column, KnowledgeColumn.visibility == "public")
    if node_type:
        query = query.where(KnowledgeNode.node_type == node_type)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(
            KnowledgeNode.title.ilike(pattern) | KnowledgeNode.summary.ilike(pattern) | KnowledgeNode.content_markdown.ilike(pattern)
        )
    nodes = list(session.scalars(query.order_by(KnowledgeNode.importance.desc(), KnowledgeNode.title)))
    node_ids = {node.id for node in nodes}
    relation_query = select(KnowledgeRelation).where(
        KnowledgeRelation.is_active.is_(True), KnowledgeRelation.is_public.is_(True),
        KnowledgeRelation.source_node_id.in_(node_ids), KnowledgeRelation.target_node_id.in_(node_ids),
    )
    if relation_type:
        relation_query = relation_query.where(KnowledgeRelation.relation_type == relation_type)
    relations = list(session.scalars(relation_query.order_by(KnowledgeRelation.weight.desc(), KnowledgeRelation.id))) if node_ids else []
    node_items = []
    degree = {node.id: 0 for node in nodes}
    for relation in relations:
        degree[relation.source_node_id] += 1
        degree[relation.target_node_id] += 1
    for node in nodes:
        payload = public_node_payload(session, node, include_relations=False)
        node_items.append({
            "id": str(node.id), "slug": node.slug, "title": node.title, "summary": node.summary,
            "node_type": node.node_type, "importance": node.importance, "degree": degree[node.id],
            "tags": payload["tag_names"],
            "columns": [{"name": item["name"], "slug": item["slug"]} for item in payload["columns"]],
            "href": f"#node-{node.slug}",
        })
    edge_items = [{
        "id": f"edge-{relation.id}", "source": str(relation.source_node_id), "target": str(relation.target_node_id),
        "relation_type": relation.relation_type, "label": relation.relation_label or relation.relation_type,
        "description": relation.description, "weight": relation.weight, "direction": relation.direction,
    } for relation in relations]
    return {
        "nodes": node_items, "edges": edge_items,
        "stats": {"node_count": len(node_items), "edge_count": len(edge_items), "connected_node_count": sum(1 for value in degree.values() if value > 0)},
        "filters": {"column": column or "", "node_type": node_type or "", "relation_type": relation_type or "", "q": q or ""},
    }


@router.get("/nodes/{slug}")
def public_node(slug: str, session: Session = Depends(get_session)) -> dict:
    node = session.scalar(select(KnowledgeNode).where(
        KnowledgeNode.slug == slug, KnowledgeNode.visibility.in_(["public", "unlisted"]),
        KnowledgeNode.deleted_at.is_(None),
    ))
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    return public_node_payload(session, node)


@router.get("/site")
def site_document(session: Session = Depends(get_session)) -> dict:
    document = read_site_document(session)
    if document is not None:
        return document
    return {"profile": {}, "projects": [], "posts": [], "knowledgeBase": []}
