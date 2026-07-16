import hashlib
import json
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Article, ArticleColumn, ArticleNode, ArticleTag, Category, ContentEntry, KnowledgeColumn, KnowledgeNode, Tag
from .search import delete_content_entry_index, index_content_entry


ARTICLE_SNAPSHOT_FIELDS = [
    "slug",
    "title",
    "summary",
    "content_md",
    "metadata_json",
    "status",
    "visibility",
    "category",
]


def slugify(value: str) -> str:
    slug = re.sub(r"[^\w\u4e00-\u9fa5-]+", "-", (value or "").strip().lower())
    return re.sub(r"-+", "-", slug).strip("-")[:120] or "untitled"


def parse_metadata(raw: str | None) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def content_hash(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def ensure_category(session: Session, name: str) -> Category | None:
    name = name.strip()
    if not name:
        return None
    category = session.scalar(select(Category).where(Category.name == name))
    if category:
        return category
    base_slug = slugify(name)
    candidate = base_slug
    suffix = 2
    while session.scalar(select(Category).where(Category.slug == candidate)):
        candidate = f"{base_slug}-{suffix}"
        suffix += 1
    category = Category(name=name, slug=candidate)
    session.add(category)
    session.flush()
    return category


def replace_tags(session: Session, article_id: int, names: list[str]) -> None:
    for link in session.scalars(select(ArticleTag).where(ArticleTag.article_id == article_id)):
        session.delete(link)
    seen: set[str] = set()
    for raw_name in names:
        name = str(raw_name).strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        tag = session.scalar(select(Tag).where(Tag.name == name))
        if not tag:
            base_slug = slugify(name)
            candidate = base_slug
            suffix = 2
            while session.scalar(select(Tag).where(Tag.slug == candidate)):
                candidate = f"{base_slug}-{suffix}"
                suffix += 1
            tag = Tag(name=name, slug=candidate)
            session.add(tag)
            session.flush()
        session.add(ArticleTag(article_id=article_id, tag_id=tag.id))


def replace_columns(session: Session, article_id: int, column_ids: list[int], primary_column_id: int | None) -> None:
    for link in session.scalars(select(ArticleColumn).where(ArticleColumn.article_id == article_id)):
        session.delete(link)
    valid_ids = set(session.scalars(select(KnowledgeColumn.id).where(KnowledgeColumn.id.in_(column_ids)))) if column_ids else set()
    for index, column_id in enumerate(dict.fromkeys(column_ids)):
        if column_id not in valid_ids:
            continue
        session.add(
            ArticleColumn(
                article_id=article_id,
                column_id=column_id,
                is_primary=column_id == primary_column_id,
                sort_order=index,
            )
        )


def apply_article_payload(session: Session, article: Article, payload: dict) -> None:
    metadata = parse_metadata(payload.get("metadata_json"))
    category = ensure_category(session, payload.get("category") or "")
    if category:
        if "columnDescription" in metadata:
            category.description = str(metadata.get("columnDescription") or "")
        if "columnCover" in metadata:
            category.cover_url = str(metadata.get("columnCover") or "")
    article.slug = payload["slug"]
    article.title = payload["title"]
    article.summary = payload.get("summary") or ""
    article.content_markdown = payload.get("content_md") or ""
    article.cover_url = metadata.get("cover", "")
    article.seo_title = metadata.get("seoTitle", "")
    article.seo_description = metadata.get("seoDescription", "")
    article.canonical_url = metadata.get("canonical", "")
    article.body_font_size = max(14, min(24, int(metadata.get("bodyFontSize") or 18)))
    article.status = payload.get("status") or "draft"
    article.visibility = payload.get("visibility") or "public"
    article.category_id = category.id if category else None
    article.is_top = bool(metadata.get("isTop", False))
    article.allow_ai_search = bool(metadata.get("allowAiSearch", True))
    session.flush()
    replace_tags(session, article.id, metadata.get("tags", []))
    replace_columns(
        session,
        article.id,
        [int(value) for value in metadata.get("columnIds", []) if str(value).isdigit()],
        int(metadata["primaryColumnId"]) if str(metadata.get("primaryColumnId", "")).isdigit() else None,
    )


def article_dict(session: Session, article: Article) -> dict:
    category = session.get(Category, article.category_id) if article.category_id else None
    tags = list(
        session.scalars(
            select(Tag)
            .join(ArticleTag, ArticleTag.tag_id == Tag.id)
            .where(ArticleTag.article_id == article.id)
            .order_by(Tag.name)
        )
    )
    column_rows = session.execute(
        select(KnowledgeColumn, ArticleColumn)
        .join(ArticleColumn, ArticleColumn.column_id == KnowledgeColumn.id)
        .where(ArticleColumn.article_id == article.id)
        .order_by(ArticleColumn.is_primary.desc(), ArticleColumn.sort_order, KnowledgeColumn.name)
    ).all()
    columns = [
        {
            "id": column.id,
            "name": column.name,
            "slug": column.slug,
            "isPrimary": link.is_primary,
        }
        for column, link in column_rows
    ]
    node_rows = session.execute(
        select(KnowledgeNode, ArticleNode)
        .join(ArticleNode, ArticleNode.node_id == KnowledgeNode.id)
        .where(ArticleNode.article_id == article.id)
        .order_by(ArticleNode.sort_order, KnowledgeNode.title)
    ).all()
    nodes = [
        {"id": node.id, "title": node.title, "slug": node.slug, "summary": node.summary,
         "node_type": node.node_type, "relation_type": link.relation_type, "visibility": node.visibility}
        for node, link in node_rows
    ]
    metadata = {
        "date": (article.published_at or article.created_at).date().isoformat() if (article.published_at or article.created_at) else "",
        "tags": [tag.name for tag in tags],
        "seoTitle": article.seo_title,
        "seoDescription": article.seo_description,
        "canonical": article.canonical_url,
        "cover": article.cover_url,
        "columnCover": category.cover_url if category else "",
        "columnDescription": category.description if category else "",
        "bodyFontSize": article.body_font_size,
        "isTop": article.is_top,
        "allowAiSearch": article.allow_ai_search,
        "columnIds": [column["id"] for column in columns],
        "primaryColumnId": next((column["id"] for column in columns if column["isPrimary"]), None),
        "columns": columns,
        "sourceArticleId": article.id,
        "nodes": nodes,
    }
    return {
        "id": article.id,
        "entity_type": "post",
        "slug": article.slug,
        "title": article.title,
        "summary": article.summary,
        "content_md": article.content_markdown,
        "content": article.content_markdown,
        "metadata_json": json.dumps(metadata, ensure_ascii=False),
        "status": article.status,
        "visibility": article.visibility,
        "category": category.name if category else "",
        "revision": article.revision,
        "created_at": article.created_at,
        "published_at": article.published_at,
        "archived_at": article.archived_at,
        "updated_at": article.updated_at,
        **metadata,
    }


def sync_search_shadow(session: Session, article: Article) -> ContentEntry:
    payload = article_dict(session, article)
    shadow = session.scalar(
        select(ContentEntry).where(ContentEntry.entity_type == "post", ContentEntry.slug == article.slug)
    )
    if not shadow:
        shadow = session.scalar(
            select(ContentEntry).where(
                ContentEntry.entity_type == "post",
                ContentEntry.metadata_json.like(f'%"sourceArticleId": {article.id}%'),
            )
        )
    if not shadow:
        shadow = ContentEntry(entity_type="post", slug=article.slug, title=article.title)
        session.add(shadow)
        session.flush()
    shadow.slug = article.slug
    shadow.title = article.title
    shadow.summary = article.summary
    shadow.content_md = article.content_markdown
    shadow.metadata_json = payload["metadata_json"]
    shadow.status = article.status
    shadow.visibility = article.visibility
    shadow.category = payload["category"]
    shadow.revision = article.revision
    shadow.published_at = article.published_at
    shadow.archived_at = article.archived_at
    if article.status == "archived":
        delete_content_entry_index(session, shadow.id)
    else:
        index_content_entry(session, shadow)
    return shadow
