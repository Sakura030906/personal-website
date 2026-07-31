import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ContentDraft, ContentEntry, ContentVersion


CONTENT_FIELDS = [
    "entity_type",
    "slug",
    "title",
    "summary",
    "content_md",
    "metadata_json",
    "status",
    "visibility",
    "category",
]


def entry_payload(entry: ContentEntry) -> dict:
    return {key: getattr(entry, key) for key in CONTENT_FIELDS}


def snapshot_json(payload: dict) -> str:
    values = {key: payload.get(key, "") for key in CONTENT_FIELDS}
    return json.dumps(values, ensure_ascii=False, sort_keys=True)


def payload_hash(payload: dict) -> str:
    return hashlib.sha256(snapshot_json(payload).encode("utf-8")).hexdigest()


def save_version(
    session: Session,
    entry: ContentEntry,
    user: str,
    reason: str = "manual_save",
    payload: dict | None = None,
) -> ContentVersion | None:
    version_payload = payload or entry_payload(entry)
    digest = payload_hash(version_payload)
    latest = session.scalar(
        select(ContentVersion)
        .where(
            ContentVersion.entity_type == entry.entity_type,
            ContentVersion.entity_id == entry.id,
        )
        .order_by(ContentVersion.id.desc())
        .limit(1)
    )
    if latest and latest.snapshot_hash == digest and latest.reason == reason:
        return None
    version = ContentVersion(
        entity_type=entry.entity_type,
        entity_id=entry.id,
        snapshot_json=snapshot_json(version_payload),
        snapshot_hash=digest,
        reason=reason,
        created_by=None,
        created_by_email=user,
    )
    session.add(version)
    return version


def delete_draft(session: Session, entry_id: int) -> None:
    draft = session.scalar(select(ContentDraft).where(ContentDraft.entry_id == entry_id))
    if draft:
        session.delete(draft)


def ensure_revision(entry: ContentEntry, expected_revision: int | None) -> None:
    if expected_revision is not None and expected_revision != entry.revision:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "内容已在其他位置修改，请重新加载后再保存。",
                "expected_revision": expected_revision,
                "current_revision": entry.revision,
            },
        )


def parse_json_list(raw: str | None) -> list:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def parse_json_object(raw: str | None) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
