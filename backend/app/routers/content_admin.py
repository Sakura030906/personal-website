import difflib
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..activity import record_activity
from ..config import settings
from ..content_versioning import (
    CONTENT_FIELDS,
    delete_draft,
    ensure_revision,
    entry_payload,
    parse_json_object,
    payload_hash,
    save_version,
    snapshot_json,
)
from ..database import get_session
from ..models import Asset, ContentDraft, ContentEntry, ContentVersion
from ..schemas import (
    ContentAutosaveIn,
    ContentDraftOut,
    ContentEntryIn,
    ContentEntryOut,
    ContentEntryUpdate,
    SiteDocument,
)
from ..search import (
    delete_content_entry_index,
    index_content_entry,
    rebuild_vector_index,
)
from ..security import require_admin
from ..site_sync import read_site_document, sync_site_document
from ..storage import publish_file
from ..upload_security import read_limited, validate_image


router = APIRouter()


@router.get("/entries", response_model=list[ContentEntryOut])
def list_entries(
    entity_type: str | None = None,
    status: str | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[ContentEntry]:
    query = select(ContentEntry).where(ContentEntry.deleted_at.is_(None)).order_by(ContentEntry.updated_at.desc())
    if entity_type:
        query = query.where(ContentEntry.entity_type == entity_type)
    if status:
        query = query.where(ContentEntry.status == status)
    return list(session.scalars(query))


@router.post("/entries", response_model=ContentEntryOut)
def create_entry(
    payload: ContentEntryIn,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentEntry:
    existing = session.scalar(
        select(ContentEntry).where(
            ContentEntry.entity_type == payload.entity_type,
            ContentEntry.slug == payload.slug,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Entry slug already exists")

    entry = ContentEntry(**payload.model_dump())
    session.add(entry)
    session.flush()
    save_version(session, entry, user, reason="created")
    record_activity(session, action="created", entity_type="entry", entity_id=entry.id,
                    entity_title=entry.title, actor_email=user)
    index_content_entry(session, entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.patch("/entries/{entry_id}", response_model=ContentEntryOut)
def update_entry(
    entry_id: int,
    payload: ContentEntryUpdate,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentEntry:
    entry = session.get(ContentEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    ensure_revision(entry, payload.expected_revision)
    save_version(session, entry, user, reason="manual_save")
    for key, value in payload.model_dump(exclude={"expected_revision"}).items():
        setattr(entry, key, value)
    entry.revision += 1
    if entry.status != "archived":
        entry.archived_at = None
    delete_draft(session, entry.id)
    record_activity(session, action="updated", entity_type="entry", entity_id=entry.id,
                    entity_title=entry.title, actor_email=user)
    index_content_entry(session, entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.post("/entries/{entry_id}/publish", response_model=ContentEntryOut)
def publish_entry(
    entry_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentEntry:
    entry = session.get(ContentEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    save_version(session, entry, user, reason="published")
    entry.status = "published"
    entry.visibility = entry.visibility or "public"
    entry.published_at = datetime.now(timezone.utc)
    entry.archived_at = None
    entry.revision += 1
    delete_draft(session, entry.id)
    record_activity(session, action="published", entity_type="entry", entity_id=entry.id,
                    entity_title=entry.title, actor_email=user)
    index_content_entry(session, entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.post("/entries/{entry_id}/archive", response_model=ContentEntryOut)
def archive_entry(
    entry_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentEntry:
    entry = session.get(ContentEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    save_version(session, entry, user, reason="archived")
    entry.status = "archived"
    entry.archived_at = datetime.now(timezone.utc)
    entry.revision += 1
    delete_draft(session, entry.id)
    delete_content_entry_index(session, entry.id)
    record_activity(session, action="archived", entity_type="entry", entity_id=entry.id,
                    entity_title=entry.title, actor_email=user)
    session.commit()
    session.refresh(entry)
    return entry


@router.get("/entries/{entry_id}/draft", response_model=ContentDraftOut | None)
def get_entry_draft(
    entry_id: int,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentDraftOut | None:
    entry = session.get(ContentEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    draft = session.scalar(select(ContentDraft).where(ContentDraft.entry_id == entry_id))
    if not draft:
        return None
    return ContentDraftOut(
        entry_id=entry_id,
        payload=parse_json_object(draft.payload_json),
        base_revision=draft.base_revision,
        saved_at=draft.saved_at,
    )


@router.post("/entries/{entry_id}/autosave", response_model=ContentDraftOut)
def autosave_entry(
    entry_id: int,
    payload: ContentAutosaveIn,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentDraftOut:
    entry = session.get(ContentEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ensure_revision(entry, payload.expected_revision)
    draft_payload = payload.model_dump(exclude={"expected_revision"})
    digest = payload_hash(draft_payload)
    draft = session.scalar(select(ContentDraft).where(ContentDraft.entry_id == entry_id))
    if not draft:
        draft = ContentDraft(
            entry_id=entry.id,
            payload_json=snapshot_json(draft_payload),
            content_hash=digest,
            base_revision=entry.revision,
        )
        session.add(draft)
    elif draft.content_hash != digest:
        draft.payload_json = snapshot_json(draft_payload)
        draft.content_hash = digest
        draft.base_revision = entry.revision
        draft.saved_at = datetime.now(timezone.utc)
    save_version(session, entry, user, reason="autosave", payload=draft_payload)
    session.commit()
    session.refresh(draft)
    return ContentDraftOut(
        entry_id=entry.id,
        payload=parse_json_object(draft.payload_json),
        base_revision=draft.base_revision,
        saved_at=draft.saved_at,
    )


@router.delete("/entries/{entry_id}")
def delete_entry(
    entry_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    entry = session.get(ContentEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    delete_content_entry_index(session, entry.id)
    save_version(session, entry, user, reason="trashed")
    entry.deleted_at = datetime.now(timezone.utc)
    record_activity(session, action="trashed", entity_type="entry", entity_id=entry.id, entity_title=entry.title, actor_email=user)
    session.commit()
    return {"status": "trashed"}


@router.get("/export")
def export_entries(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, list[dict[str, str | int | None]]]:
    entries = session.scalars(select(ContentEntry).order_by(ContentEntry.updated_at.desc()))
    return {
        "entries": [
            {
                "id": entry.id,
                "entity_type": entry.entity_type,
                "slug": entry.slug,
                "title": entry.title,
                "summary": entry.summary,
                "content_md": entry.content_md,
                "metadata_json": entry.metadata_json,
                "status": entry.status,
                "visibility": entry.visibility,
                "category": entry.category,
                "revision": entry.revision,
            }
            for entry in entries
        ]
    }


@router.post("/import")
def import_entries(
    payload: dict,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, int]:
    imported = 0
    for raw_entry in payload.get("entries", []):
        entry_input = ContentEntryIn(**raw_entry)
        existing = session.scalar(
            select(ContentEntry).where(
                ContentEntry.entity_type == entry_input.entity_type,
                ContentEntry.slug == entry_input.slug,
            )
        )
        if existing:
            save_version(session, existing, user)
            for key, value in entry_input.model_dump().items():
                setattr(existing, key, value)
            index_content_entry(session, existing)
        else:
            entry = ContentEntry(**entry_input.model_dump())
            session.add(entry)
            session.flush()
            index_content_entry(session, entry)
        imported += 1
    session.commit()
    return {"imported": imported}


@router.get("/site")
def get_site_document(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    document = read_site_document(session)
    if document is None:
        raise HTTPException(status_code=404, detail="No site document has been synced")
    return document


@router.post("/site")
def save_site_document(
    payload: SiteDocument,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, int | str]:
    sync_site_document(session, payload.data)
    index_result = rebuild_vector_index(session)
    return {
        "status": "synced",
        "projects": len(payload.data.get("projects", []) or []),
        "posts": len(payload.data.get("posts", []) or []),
        "knowledge": len(payload.data.get("knowledgeBase", []) or []),
        "reading": len(payload.data.get("reading", []) or []),
        "indexed_entries": index_result["entries"],
        "indexed_chunks": index_result["chunks"],
    }


@router.get("/versions/{entity_type}/{entity_id}")
def list_versions(
    entity_type: str,
    entity_id: int,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[dict[str, str | int]]:
    versions = session.scalars(
        select(ContentVersion)
        .where(ContentVersion.entity_type == entity_type, ContentVersion.entity_id == entity_id)
        .order_by(ContentVersion.created_at.desc(), ContentVersion.id.desc())
    )
    return [
        {
            "id": version.id,
            "entity_type": version.entity_type,
            "entity_id": version.entity_id,
            "snapshot_json": version.snapshot_json,
                "reason": version.reason,
                "created_by_email": version.created_by_email,
            "snapshot_hash": version.snapshot_hash,
            "created_at": version.created_at.isoformat() if version.created_at else "",
        }
        for version in versions
    ]


@router.get("/versions/{version_id}/diff")
def version_diff(
    version_id: int,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    version = session.get(ContentVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    entry = session.get(ContentEntry, version.entity_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    old = parse_json_object(version.snapshot_json)
    current = entry_payload(entry)
    changed_fields = [key for key in CONTENT_FIELDS if old.get(key) != current.get(key)]
    content_diff = list(
        difflib.unified_diff(
            str(old.get("content_md") or "").splitlines(),
            str(current.get("content_md") or "").splitlines(),
            fromfile=f"version-{version.id}",
            tofile="current",
            lineterm="",
        )
    )
    return {
        "version_id": version.id,
        "reason": version.reason,
        "changed_fields": changed_fields,
        "content_diff": "\n".join(content_diff),
        "snapshot": old,
        "current_revision": entry.revision,
    }


@router.post("/versions/{version_id}/restore", response_model=ContentEntryOut)
def restore_version(
    version_id: int,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentEntry:
    version = session.get(ContentVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    entry = session.get(ContentEntry, version.entity_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    save_version(session, entry, user, reason="before_restore")
    snapshot_data = json.loads(version.snapshot_json)
    for key in CONTENT_FIELDS:
        setattr(entry, key, snapshot_data.get(key, getattr(entry, key)))
    entry.revision += 1
    entry.archived_at = datetime.now(timezone.utc) if entry.status == "archived" else None
    delete_draft(session, entry.id)
    index_content_entry(session, entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.post("/assets")
async def upload_asset(
    file: UploadFile = File(...),
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str | int | None]:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    original_name = Path(file.filename or "upload.bin").name
    data = await read_limited(file, settings.asset_max_bytes)
    suffix, content_type = validate_image(data, original_name, file.content_type)
    target = upload_dir / f"{uuid4().hex}{suffix}"
    target.write_bytes(data)
    public_url = publish_file(target, target.name, content_type)

    asset = Asset(
        filename=target.name,
        content_type=content_type,
        size_bytes=target.stat().st_size,
        url=public_url,
    )
    session.add(asset)
    session.commit()
    return {
        "id": asset.id,
        "filename": asset.filename,
        "content_type": asset.content_type,
        "size_bytes": asset.size_bytes,
        "url": asset.url,
    }
