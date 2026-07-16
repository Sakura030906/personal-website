import hashlib
import json

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .article_service import slugify
from .models import (
    Article, ArticleNode, KnowledgeColumn, KnowledgeColumnNode, KnowledgeNode,
    KnowledgeRelation, NodeTag, Tag,
)


NODE_SNAPSHOT_FIELDS = [
    "title", "slug", "summary", "content_markdown", "node_type", "importance",
    "visibility", "allow_ai_search", "tag_names", "column_ids", "primary_column_id",
    "article_ids", "article_relation_type",
]


def payload_hash(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def ensure_tag(session: Session, name: str) -> Tag:
    tag = session.scalar(select(Tag).where(Tag.name == name))
    if tag:
        return tag
    base = slugify(name)
    candidate = base
    suffix = 2
    while session.scalar(select(Tag).where(Tag.slug == candidate)):
        candidate = f"{base}-{suffix}"
        suffix += 1
    tag = Tag(name=name, slug=candidate)
    session.add(tag)
    session.flush()
    return tag


def replace_node_links(session: Session, node: KnowledgeNode, payload: dict) -> None:
    for model, condition in [
        (NodeTag, NodeTag.node_id == node.id),
        (KnowledgeColumnNode, KnowledgeColumnNode.node_id == node.id),
        (ArticleNode, ArticleNode.node_id == node.id),
    ]:
        for row in session.scalars(select(model).where(condition)):
            session.delete(row)
    session.flush()

    seen: set[str] = set()
    for raw in payload.get("tag_names", []):
        name = str(raw).strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        session.add(NodeTag(node_id=node.id, tag_id=ensure_tag(session, name).id))

    column_ids = list(dict.fromkeys(int(value) for value in payload.get("column_ids", []) if str(value).isdigit()))
    valid_columns = set(session.scalars(select(KnowledgeColumn.id).where(KnowledgeColumn.id.in_(column_ids)))) if column_ids else set()
    primary = payload.get("primary_column_id")
    for order, column_id in enumerate(column_ids):
        if column_id in valid_columns:
            session.add(KnowledgeColumnNode(
                column_id=column_id, node_id=node.id,
                is_primary=column_id == primary, sort_order=order,
            ))

    article_ids = list(dict.fromkeys(int(value) for value in payload.get("article_ids", []) if str(value).isdigit()))
    valid_articles = set(session.scalars(select(Article.id).where(Article.id.in_(article_ids)))) if article_ids else set()
    for order, article_id in enumerate(article_ids):
        if article_id in valid_articles:
            session.add(ArticleNode(
                article_id=article_id, node_id=node.id,
                relation_type=payload.get("article_relation_type") or "references", sort_order=order,
            ))


def apply_node_payload(session: Session, node: KnowledgeNode, payload: dict) -> None:
    for key in ["title", "slug", "summary", "content_markdown", "node_type", "importance", "visibility", "allow_ai_search"]:
        if key in payload:
            setattr(node, key, payload[key])
    session.flush()
    replace_node_links(session, node, payload)


def node_dict(session: Session, node: KnowledgeNode, include_relations: bool = True) -> dict:
    tags = list(session.scalars(
        select(Tag).join(NodeTag, NodeTag.tag_id == Tag.id)
        .where(NodeTag.node_id == node.id).order_by(Tag.name)
    ))
    column_rows = session.execute(
        select(KnowledgeColumn, KnowledgeColumnNode)
        .join(KnowledgeColumnNode, KnowledgeColumnNode.column_id == KnowledgeColumn.id)
        .where(KnowledgeColumnNode.node_id == node.id)
        .order_by(KnowledgeColumnNode.is_primary.desc(), KnowledgeColumnNode.sort_order)
    ).all()
    article_rows = session.execute(
        select(Article, ArticleNode).join(ArticleNode, ArticleNode.article_id == Article.id)
        .where(ArticleNode.node_id == node.id).order_by(ArticleNode.sort_order, Article.title)
    ).all()
    result = {
        "id": node.id, "title": node.title, "slug": node.slug, "summary": node.summary,
        "content_markdown": node.content_markdown, "content": node.content_markdown,
        "node_type": node.node_type, "importance": node.importance,
        "visibility": node.visibility, "allow_ai_search": node.allow_ai_search,
        "revision": node.revision, "tag_names": [tag.name for tag in tags],
        "column_ids": [column.id for column, _ in column_rows],
        "primary_column_id": next((column.id for column, link in column_rows if link.is_primary), None),
        "columns": [{"id": column.id, "name": column.name, "slug": column.slug, "is_primary": link.is_primary} for column, link in column_rows],
        "article_ids": [article.id for article, _ in article_rows],
        "article_relation_type": article_rows[0][1].relation_type if article_rows else "references",
        "articles": [{"id": article.id, "title": article.title, "slug": article.slug, "summary": article.summary, "relation_type": link.relation_type, "status": article.status, "visibility": article.visibility} for article, link in article_rows],
        "created_at": node.created_at, "updated_at": node.updated_at,
    }
    if include_relations:
        rows = list(session.scalars(select(KnowledgeRelation).where(or_(
            KnowledgeRelation.source_node_id == node.id,
            KnowledgeRelation.target_node_id == node.id,
        )).order_by(KnowledgeRelation.relation_type, KnowledgeRelation.id)))
        result["relations"] = [relation_dict(session, row, perspective_node_id=node.id) for row in rows]
    return result


def relation_dict(session: Session, relation: KnowledgeRelation, perspective_node_id: int | None = None) -> dict:
    source = session.get(KnowledgeNode, relation.source_node_id)
    target = session.get(KnowledgeNode, relation.target_node_id)
    perspective = "outgoing" if perspective_node_id == relation.source_node_id else "incoming" if perspective_node_id == relation.target_node_id else ""
    other = target if perspective == "outgoing" else source if perspective == "incoming" else None
    return {
        "id": relation.id, "source_node_id": relation.source_node_id,
        "target_node_id": relation.target_node_id, "relation_type": relation.relation_type,
        "relation_label": relation.relation_label, "description": relation.description,
        "weight": relation.weight, "direction": relation.direction,
        "is_active": relation.is_active, "is_public": relation.is_public,
        "source": {"id": source.id, "title": source.title, "slug": source.slug, "visibility": source.visibility} if source else None,
        "target": {"id": target.id, "title": target.title, "slug": target.slug, "visibility": target.visibility} if target else None,
        "perspective": perspective,
        "other_node": {"id": other.id, "title": other.title, "slug": other.slug, "summary": other.summary, "node_type": other.node_type, "visibility": other.visibility} if other else None,
        "created_at": relation.created_at, "updated_at": relation.updated_at,
    }
