import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .article_service import apply_article_payload, article_dict, content_hash, sync_search_shadow
from .models import Article, ContentEntry, ContentVersion

SITE_ENTITY_TYPE = "site"
SITE_SLUG = "site-json"


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def loads(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def snapshot(entry: ContentEntry) -> str:
    return dumps(
        {
            "entity_type": entry.entity_type,
            "slug": entry.slug,
            "title": entry.title,
            "summary": entry.summary,
            "content_md": entry.content_md,
            "metadata_json": entry.metadata_json,
            "status": entry.status,
            "category": entry.category,
        }
    )


def save_version(session: Session, entry: ContentEntry) -> None:
    session.add(
        ContentVersion(
            entity_type=entry.entity_type,
            entity_id=entry.id,
            snapshot_json=snapshot(entry),
            created_by=None,
        )
    )


def upsert_entry(session: Session, payload: dict[str, Any], create_version: bool = True) -> ContentEntry:
    existing = session.scalar(
        select(ContentEntry).where(
            ContentEntry.entity_type == payload["entity_type"],
            ContentEntry.slug == payload["slug"],
        )
    )
    if existing:
        if create_version:
            save_version(session, existing)
        for key, value in payload.items():
            setattr(existing, key, value)
        return existing

    entry = ContentEntry(**payload)
    session.add(entry)
    session.flush()
    if create_version:
        save_version(session, entry)
    return entry


def project_to_entry(project: dict[str, Any]) -> dict[str, Any]:
    slug = project.get("slug") or project.get("name") or "project"
    metadata = {key: value for key, value in project.items() if key not in {"name", "summary", "slug"}}
    details = "\n".join(
        [
            project.get("problem", ""),
            project.get("architecture", ""),
            "\n".join(project.get("details", []) or []),
            "\n".join(project.get("modules", []) or []),
            "\n".join(project.get("nextSteps", []) or []),
        ]
    ).strip()
    return {
        "entity_type": "project",
        "slug": slug,
        "title": project.get("name") or slug,
        "summary": project.get("summary", ""),
        "content_md": details,
        "metadata_json": dumps(metadata),
        "status": "published",
        "category": "project",
    }


def post_to_entry(post: dict[str, Any]) -> dict[str, Any]:
    slug = post.get("slug") or post.get("title") or "post"
    metadata = {key: value for key, value in post.items() if key not in {"title", "summary", "slug", "content", "status", "category"}}
    return {
        "entity_type": "post",
        "slug": slug,
        "title": post.get("title") or slug,
        "summary": post.get("summary", ""),
        "content_md": post.get("content", ""),
        "metadata_json": dumps(metadata),
        "status": post.get("status") or "draft",
        "visibility": post.get("visibility") or "public",
        "category": post.get("category", ""),
    }


def upsert_article(session: Session, post: dict[str, Any]) -> Article:
    payload = post_to_entry(post)
    article = session.scalar(select(Article).where(Article.slug == payload["slug"]))
    if article:
        previous = article_dict(session, article)
        previous_payload = {
            key: previous.get(key, "")
            for key in ["slug", "title", "summary", "content_md", "metadata_json", "status", "visibility", "category"]
        }
        session.add(
            ContentVersion(
                entity_type="article",
                entity_id=article.id,
                snapshot_json=dumps(previous_payload),
                snapshot_hash=content_hash(previous_payload),
                reason="site_sync",
                created_by_email="site-sync",
            )
        )
        article.revision += 1
    else:
        article = Article(title=payload["title"], slug=payload["slug"])
        session.add(article)
        session.flush()
    apply_article_payload(session, article, payload)
    published_at_now(article)
    sync_search_shadow(session, article)
    return article


def knowledge_to_entry(topic: dict[str, Any]) -> dict[str, Any]:
    slug = topic.get("slug") or topic.get("topic") or "knowledge"
    notes = topic.get("notes", []) or []
    relation_lines = [
        *[f"相关知识：{item}" for item in topic.get("relatedKnowledge", []) or []],
        *[f"关联项目：{item}" for item in topic.get("relatedProjects", []) or []],
        *[f"阅读材料：{item}" for item in topic.get("relatedReading", []) or []],
        *[f"相关文章：{item}" for item in topic.get("relatedPosts", []) or []],
    ]
    content = "\n\n".join(
        [
            "\n".join(
                [
                    f"## {note.get('name', '')}",
                    note.get("description", ""),
                    note.get("example", ""),
                    " ".join([f"链接：{item}" for item in note.get("links", []) or []]),
                ]
            ).strip()
            for note in notes
            if isinstance(note, dict)
        ]
    )
    content = "\n\n".join(["\n".join(relation_lines), content]).strip()
    metadata = {key: value for key, value in topic.items() if key not in {"topic", "summary", "slug"}}
    return {
        "entity_type": "knowledge",
        "slug": slug,
        "title": topic.get("topic") or slug,
        "summary": topic.get("summary", ""),
        "content_md": content,
        "metadata_json": dumps(metadata),
        "status": "published",
        "category": "knowledge",
    }


def reading_to_entry(item: dict[str, Any]) -> dict[str, Any]:
    slug = item.get("slug") or item.get("title") or "reading"
    metadata = {key: value for key, value in item.items() if key not in {"title", "note", "slug"}}
    highlights = item.get("highlights", []) or []
    content = "\n\n".join(
        [
            item.get("note", ""),
            "\n".join([f"- {highlight}" for highlight in highlights]),
        ]
    ).strip()
    return {
        "entity_type": "reading",
        "slug": slug,
        "title": item.get("title") or slug,
        "summary": item.get("note", ""),
        "content_md": content,
        "metadata_json": dumps(metadata),
        "status": "published" if item.get("status") in {"读完", "已读", "finished"} else "draft",
        "category": "reading",
    }


def sync_site_document(session: Session, site_data: dict[str, Any]) -> None:
    upsert_entry(
        session,
        {
            "entity_type": SITE_ENTITY_TYPE,
            "slug": SITE_SLUG,
            "title": "Site JSON",
            "summary": "Current public site document",
            "content_md": dumps(site_data),
            "metadata_json": "{}",
            "status": "published",
            "category": "system",
        },
    )

    for project in site_data.get("projects", []) or []:
        if isinstance(project, dict):
            upsert_entry(session, project_to_entry(project))
    for post in site_data.get("posts", []) or []:
        if isinstance(post, dict):
            upsert_article(session, post)
    for topic in site_data.get("knowledgeBase", []) or []:
        if isinstance(topic, dict):
            upsert_entry(session, knowledge_to_entry(topic))
    for item in site_data.get("reading", []) or []:
        if isinstance(item, dict):
            upsert_entry(session, reading_to_entry(item))


def read_site_document(session: Session) -> dict[str, Any] | None:
    entry = session.scalar(
        select(ContentEntry).where(
            ContentEntry.entity_type == SITE_ENTITY_TYPE,
            ContentEntry.slug == SITE_SLUG,
        )
    )
    if not entry:
        return None
    return loads(entry.content_md, None)


def published_at_now(entry: ContentEntry | Article) -> None:
    if entry.status == "published" and entry.published_at is None:
        entry.published_at = datetime.now(timezone.utc)
