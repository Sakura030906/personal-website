import difflib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..article_service import ARTICLE_SNAPSHOT_FIELDS, apply_article_payload, article_dict, content_hash, replace_tags, sync_search_shadow
from ..activity import record_activity
from ..content_enhancement import field_diffs, model_enhancement, related_nodes, suggested_tags, summary_for
from ..database import get_session
from ..models import Article, ArticleColumn, ArticleDraft, ArticleNode, ArticleTag, ContentEntry, ContentVersion, KnowledgeColumn, KnowledgeColumnNode, KnowledgeNode
from ..schemas import ArticleAutosave, ArticleWrite, ContentEnhancementApply, ContentEnhancementRequest, KnowledgeColumnWrite
from ..search import delete_content_entry_index
from ..security import require_admin


router = APIRouter()


def clean_payload(payload: ArticleWrite) -> dict:
    return payload.model_dump(exclude={"expected_revision", "entity_type"})


def snapshot(payload: dict) -> str:
    return json.dumps({key: payload.get(key, "") for key in ARTICLE_SNAPSHOT_FIELDS}, ensure_ascii=False, sort_keys=True)


def save_version(session: Session, article: Article, payload: dict, user: str, reason: str) -> None:
    digest = content_hash(payload)
    latest = session.scalar(
        select(ContentVersion)
        .where(ContentVersion.entity_type == "article", ContentVersion.entity_id == article.id)
        .order_by(ContentVersion.id.desc())
    )
    if latest and latest.snapshot_hash == digest and latest.reason == reason:
        return
    session.add(
        ContentVersion(
            entity_type="article",
            entity_id=article.id,
            snapshot_json=snapshot(payload),
            snapshot_hash=digest,
            reason=reason,
            created_by_email=user,
        )
    )


def current_payload(session: Session, article: Article) -> dict:
    payload = article_dict(session, article)
    return {key: payload.get(key, "") for key in ARTICLE_SNAPSHOT_FIELDS}


def ensure_revision(article: Article, expected_revision: int | None) -> None:
    if expected_revision is not None and article.revision != expected_revision:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "文章已在其他位置修改，请重新加载后继续。",
                "expected_revision": expected_revision,
                "current_revision": article.revision,
            },
        )


def delete_draft(session: Session, article_id: int) -> None:
    draft = session.scalar(select(ArticleDraft).where(ArticleDraft.article_id == article_id))
    if draft:
        session.delete(draft)


@router.post("/articles/{article_id}/enhancement/suggest")
def suggest_article_enhancement(
    article_id: int, payload: ContentEnhancementRequest,
    _: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    article = session.get(Article, article_id)
    if not article or article.deleted_at:
        raise HTTPException(status_code=404, detail="Article not found")
    current_payload = article_dict(session, article)
    metadata = json.loads(current_payload["metadata_json"] or "{}")
    source_text = f"{article.title} {article.summary} {article.content_markdown}"
    current = {
        "summary": article.summary, "tags": metadata.get("tags", []),
        "seo_title": article.seo_title, "seo_description": article.seo_description,
        "related_nodes": [{"id": row["id"], "title": row["title"]} for row in current_payload.get("nodes", [])],
    }
    local = {
        "summary": summary_for(article.title, article.summary, article.content_markdown),
        "tags": suggested_tags(session, source_text, current["tags"]),
        "seo_title": (article.seo_title or article.title)[:120],
        "seo_description": (article.seo_description or summary_for(article.title, article.summary, article.content_markdown))[:300],
        "related_nodes": related_nodes(session, source_text),
    }
    proposal, generator, usage, model_applied = model_enhancement(
        "article", {"title": article.title, "summary": article.summary, "content": article.content_markdown[:6000]}, local, payload.mode,
    )
    fields = ["summary", "tags", "seo_title", "seo_description", "related_nodes"]
    return {"entity_type": "article", "entity_id": article.id, "revision": article.revision,
            "current": current, "proposal": proposal, "fields": field_diffs(current, proposal, fields),
            "generator": generator, "model_applied": model_applied, "usage": usage,
            "safety": "仅生成建议；勾选字段并确认后才会写入，且不会发布文章。"}


@router.post("/articles/{article_id}/enhancement/apply")
def apply_article_enhancement(
    article_id: int, payload: ContentEnhancementApply,
    user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    article = session.get(Article, article_id)
    if not article or article.deleted_at:
        raise HTTPException(status_code=404, detail="Article not found")
    ensure_revision(article, payload.expected_revision)
    allowed = {"summary", "tags", "seo_title", "seo_description", "related_nodes"}
    selected = list(dict.fromkeys(field for field in payload.selected_fields if field in allowed))
    if not selected:
        raise HTTPException(status_code=422, detail="Select at least one enhancement field")
    proposal = payload.proposal
    save_version(session, article, current_payload(session, article), user, "before_ai_enhancement")
    if "summary" in selected and isinstance(proposal.get("summary"), str):
        article.summary = proposal["summary"].strip()[:500]
    if "tags" in selected and isinstance(proposal.get("tags"), list):
        replace_tags(session, article.id, [str(value).strip()[:80] for value in proposal["tags"] if str(value).strip()][:8])
    if "seo_title" in selected and isinstance(proposal.get("seo_title"), str):
        article.seo_title = proposal["seo_title"].strip()[:255]
    if "seo_description" in selected and isinstance(proposal.get("seo_description"), str):
        article.seo_description = proposal["seo_description"].strip()[:500]
    if "related_nodes" in selected and isinstance(proposal.get("related_nodes"), list):
        existing_ids = set(session.scalars(select(ArticleNode.node_id).where(ArticleNode.article_id == article.id)))
        candidate_ids = [item.get("id") for item in proposal["related_nodes"] if isinstance(item, dict) and isinstance(item.get("id"), int)]
        valid_ids = set(session.scalars(select(KnowledgeNode.id).where(KnowledgeNode.id.in_(candidate_ids)))) if candidate_ids else set()
        for node_id in candidate_ids:
            if node_id in valid_ids and node_id not in existing_ids:
                session.add(ArticleNode(article_id=article.id, node_id=node_id, relation_type="references", sort_order=len(existing_ids)))
                existing_ids.add(node_id)
    article.revision += 1
    sync_search_shadow(session, article)
    record_activity(session, action="ai_enhancement_applied", entity_type="article", entity_id=article.id,
                    entity_title=article.title, actor_email=user, detail={"selected_fields": selected})
    session.commit()
    session.refresh(article)
    return {"article": article_dict(session, article), "applied_fields": selected}


@router.get("/articles")
def list_articles(
    status: str | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[dict]:
    query = select(Article).where(Article.deleted_at.is_(None)).order_by(Article.updated_at.desc(), Article.id.desc())
    if status:
        query = query.where(Article.status == status)
    return [article_dict(session, article) for article in session.scalars(query)]


@router.post("/articles")
def create_article(
    payload: ArticleWrite,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    if session.scalar(select(Article).where(Article.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Article slug already exists")
    article = Article(title=payload.title, slug=payload.slug)
    session.add(article)
    session.flush()
    raw = clean_payload(payload)
    apply_article_payload(session, article, raw)
    save_version(session, article, raw, user, "created")
    record_activity(session, action="created", entity_type="article", entity_id=article.id, entity_title=article.title, actor_email=user)
    sync_search_shadow(session, article)
    session.commit()
    session.refresh(article)
    return article_dict(session, article)


@router.patch("/articles/{article_id}")
def update_article(
    article_id: int,
    payload: ArticleWrite,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    ensure_revision(article, payload.expected_revision)
    raw = clean_payload(payload)
    save_version(session, article, current_payload(session, article), user, "manual_save")
    apply_article_payload(session, article, raw)
    article.revision += 1
    article.archived_at = datetime.now(timezone.utc) if article.status == "archived" else None
    delete_draft(session, article.id)
    sync_search_shadow(session, article)
    record_activity(session, action="updated", entity_type="article", entity_id=article.id,
                    entity_title=article.title, actor_email=user)
    session.commit()
    session.refresh(article)
    return article_dict(session, article)


@router.get("/articles/{article_id}/draft")
def get_article_draft(
    article_id: int,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict | None:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    draft = session.scalar(select(ArticleDraft).where(ArticleDraft.article_id == article_id))
    if not draft:
        return None
    return {
        "entry_id": article_id,
        "payload": json.loads(draft.payload_json),
        "base_revision": draft.base_revision,
        "saved_at": draft.saved_at,
    }


@router.post("/articles/{article_id}/autosave")
def autosave_article(
    article_id: int,
    payload: ArticleAutosave,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    ensure_revision(article, payload.expected_revision)
    raw = clean_payload(payload)
    digest = content_hash(raw)
    draft = session.scalar(select(ArticleDraft).where(ArticleDraft.article_id == article_id))
    if not draft:
        draft = ArticleDraft(
            article_id=article_id,
            payload_json=snapshot(raw),
            content_hash=digest,
            base_revision=article.revision,
        )
        session.add(draft)
    elif draft.content_hash != digest:
        draft.payload_json = snapshot(raw)
        draft.content_hash = digest
        draft.base_revision = article.revision
        draft.saved_at = datetime.now(timezone.utc)
    save_version(session, article, raw, user, "autosave")
    session.commit()
    session.refresh(draft)
    return {
        "entry_id": article_id,
        "payload": json.loads(draft.payload_json),
        "base_revision": draft.base_revision,
        "saved_at": draft.saved_at,
    }


@router.post("/articles/{article_id}/publish")
def publish_article(
    article_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    save_version(session, article, current_payload(session, article), user, "published")
    article.status = "published"
    article.published_at = datetime.now(timezone.utc)
    article.archived_at = None
    article.revision += 1
    delete_draft(session, article.id)
    sync_search_shadow(session, article)
    record_activity(session, action="published", entity_type="article", entity_id=article.id,
                    entity_title=article.title, actor_email=user)
    session.commit()
    session.refresh(article)
    return article_dict(session, article)


@router.post("/articles/{article_id}/archive")
def archive_article(
    article_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    save_version(session, article, current_payload(session, article), user, "archived")
    article.status = "archived"
    article.archived_at = datetime.now(timezone.utc)
    article.revision += 1
    delete_draft(session, article.id)
    sync_search_shadow(session, article)
    record_activity(session, action="archived", entity_type="article", entity_id=article.id,
                    entity_title=article.title, actor_email=user)
    session.commit()
    session.refresh(article)
    return article_dict(session, article)


@router.delete("/articles/{article_id}")
def delete_article(
    article_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    save_version(session, article, current_payload(session, article), user, "trashed")
    article.deleted_at = datetime.now(timezone.utc)
    shadow = session.scalar(select(ContentEntry).where(ContentEntry.entity_type == "post", ContentEntry.slug == article.slug))
    if shadow:
        delete_content_entry_index(session, shadow.id)
        shadow.deleted_at = article.deleted_at
    record_activity(session, action="trashed", entity_type="article", entity_id=article.id, entity_title=article.title, actor_email=user)
    session.commit()
    return {"status": "trashed"}


@router.get("/articles/{article_id}/versions")
def article_versions(
    article_id: int,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[dict]:
    versions = session.scalars(
        select(ContentVersion)
        .where(ContentVersion.entity_type == "article", ContentVersion.entity_id == article_id)
        .order_by(ContentVersion.created_at.desc(), ContentVersion.id.desc())
    )
    return [
        {
            "id": version.id,
            "entity_type": version.entity_type,
            "entity_id": version.entity_id,
            "snapshot_json": version.snapshot_json,
            "snapshot_hash": version.snapshot_hash,
            "reason": version.reason,
            "created_by_email": version.created_by_email,
            "created_at": version.created_at.isoformat() if version.created_at else "",
        }
        for version in versions
    ]


@router.get("/articles/versions/{version_id}/diff")
def article_version_diff(
    version_id: int,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    version = session.get(ContentVersion, version_id)
    if not version or version.entity_type != "article":
        raise HTTPException(status_code=404, detail="Article version not found")
    article = session.get(Article, version.entity_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    old = json.loads(version.snapshot_json)
    current = current_payload(session, article)
    changed = [field for field in ARTICLE_SNAPSHOT_FIELDS if old.get(field) != current.get(field)]
    diff = difflib.unified_diff(
        str(old.get("content_md") or "").splitlines(),
        str(current.get("content_md") or "").splitlines(),
        fromfile=f"version-{version.id}",
        tofile="current",
        lineterm="",
    )
    return {"version_id": version.id, "reason": version.reason, "changed_fields": changed, "content_diff": "\n".join(diff)}


@router.post("/articles/versions/{version_id}/restore")
def restore_article_version(
    version_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    version = session.get(ContentVersion, version_id)
    if not version or version.entity_type != "article":
        raise HTTPException(status_code=404, detail="Article version not found")
    article = session.get(Article, version.entity_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    save_version(session, article, current_payload(session, article), user, "before_restore")
    apply_article_payload(session, article, json.loads(version.snapshot_json))
    article.revision += 1
    article.archived_at = datetime.now(timezone.utc) if article.status == "archived" else None
    delete_draft(session, article.id)
    sync_search_shadow(session, article)
    session.commit()
    session.refresh(article)
    return article_dict(session, article)


def column_dict(session: Session, column: KnowledgeColumn) -> dict:
    article_count = session.scalar(
        select(func.count()).select_from(ArticleColumn).where(ArticleColumn.column_id == column.id)
    ) or 0
    node_count = session.scalar(
        select(func.count()).select_from(KnowledgeColumnNode).where(KnowledgeColumnNode.column_id == column.id)
    ) or 0
    return {
        "id": column.id,
        "name": column.name,
        "slug": column.slug,
        "description": column.description,
        "cover_url": column.cover_url,
        "icon": column.icon,
        "visibility": column.visibility,
        "allow_ai_search": column.allow_ai_search,
        "sort_order": column.sort_order,
        "article_count": article_count,
        "node_count": node_count,
        "created_at": column.created_at,
        "updated_at": column.updated_at,
    }


@router.get("/knowledge-columns")
def list_columns(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[dict]:
    columns = session.scalars(
        select(KnowledgeColumn)
        .where(KnowledgeColumn.deleted_at.is_(None))
        .order_by(KnowledgeColumn.sort_order, KnowledgeColumn.name)
    )
    return [column_dict(session, column) for column in columns]


@router.post("/knowledge-columns")
def create_column(
    payload: KnowledgeColumnWrite,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    if session.scalar(select(KnowledgeColumn).where(KnowledgeColumn.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Knowledge column slug already exists")
    column = KnowledgeColumn(**payload.model_dump())
    session.add(column)
    session.flush()
    record_activity(session, action="created", entity_type="knowledge_column",
                    entity_id=column.id, entity_title=column.name, actor_email=_)
    session.commit()
    session.refresh(column)
    return column_dict(session, column)


@router.patch("/knowledge-columns/{column_id}")
def update_column(
    column_id: int,
    payload: KnowledgeColumnWrite,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    column = session.get(KnowledgeColumn, column_id)
    if not column:
        raise HTTPException(status_code=404, detail="Knowledge column not found")
    for key, value in payload.model_dump().items():
        setattr(column, key, value)
    record_activity(session, action="updated", entity_type="knowledge_column",
                    entity_id=column.id, entity_title=column.name, actor_email=_)
    session.commit()
    session.refresh(column)
    return column_dict(session, column)


@router.delete("/knowledge-columns/{column_id}")
def delete_column(
    column_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    column = session.get(KnowledgeColumn, column_id)
    if not column:
        raise HTTPException(status_code=404, detail="Knowledge column not found")
    if column.deleted_at:
        raise HTTPException(status_code=404, detail="Knowledge column not found")
    column.deleted_at = datetime.now(timezone.utc)
    record_activity(
        session, action="trashed", entity_type="knowledge_column",
        entity_id=column.id, entity_title=column.name, actor_email=user,
    )
    session.commit()
    return {"status": "trashed"}
