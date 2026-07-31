import difflib
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..article_service import slugify
from ..activity import record_activity
from ..config import settings
from ..database import get_session
from ..document_service import (
    SUPPORTED_DOCUMENT_EXTENSIONS, chunk_dict, document_dict, document_snapshot, parse_and_rechunk,
    replace_document_nodes, restore_chunks, save_document_version, update_chunk_embedding,
    sync_document_vectors,
)
from ..models import ContentVersion, Document, DocumentChunk, DocumentNode, KnowledgeColumn
from ..schemas import DocumentChunkUpdate, DocumentRechunk, DocumentUpdate
from ..security import require_admin
from ..storage import publish_file
from ..upload_security import read_limited, validate_document
from ..vector_store import delete_document_vectors


router = APIRouter()


def get_document_or_404(session: Session, document_id: int) -> Document:
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def unique_slug(session: Session, value: str) -> str:
    base = slugify(value) or f"document-{uuid4().hex[:8]}"
    candidate = base
    suffix = 2
    while session.scalar(select(Document).where(Document.slug == candidate)):
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


@router.get("/documents")
def list_documents(_: str = Depends(require_admin), session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(Document).where(Document.deleted_at.is_(None)).order_by(Document.updated_at.desc(), Document.id.desc()))
    return [document_dict(session, document) for document in rows]


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    column_id: int | None = Form(None),
    visibility: str = Form("private"),
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    original_name = Path(file.filename or "document.txt").name
    data = await read_limited(file, settings.document_max_bytes)
    suffix, content_type = validate_document(data, original_name, file.content_type)
    if suffix not in SUPPORTED_DOCUMENT_EXTENSIONS:
        raise HTTPException(status_code=415, detail="仅支持 PDF、DOCX、Markdown 和 TXT 文件")
    if visibility not in {"public", "private", "unlisted"}:
        raise HTTPException(status_code=422, detail="Invalid visibility")
    if column_id and not session.get(KnowledgeColumn, column_id):
        raise HTTPException(status_code=404, detail="Knowledge column not found")

    document_dir = Path(settings.upload_dir) / "documents"
    document_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{suffix}"
    target = document_dir / stored_name
    target.write_bytes(data)
    size = len(data)

    resolved_title = title.strip() or Path(original_name).stem
    document = Document(
        title=resolved_title, slug=unique_slug(session, resolved_title), summary="",
        original_filename=original_name, stored_filename=stored_name,
        content_type=content_type, size_bytes=size,
        file_url=f"/uploads/documents/{stored_name}", status="processing", visibility=visibility,
        column_id=column_id, metadata_json=json.dumps({"source": "cms_upload"}),
        chunk_size=settings.document_chunk_size, chunk_overlap=settings.document_chunk_overlap,
    )
    session.add(document)
    session.flush()
    try:
        parse_and_rechunk(session, document, target)
    except Exception as error:
        document.status = "error"
        document.parse_error = str(error)[:2000]
    document.file_url = publish_file(target, f"documents/{stored_name}", document.content_type)
    save_document_version(session, document, user, "uploaded")
    record_activity(session, action="created", entity_type="document", entity_id=document.id,
                    entity_title=document.title, actor_email=user)
    session.commit()
    session.refresh(document)
    return document_dict(session, document, include_chunks=True)


@router.get("/documents/{document_id}")
def get_document(document_id: int, _: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    return document_dict(session, get_document_or_404(session, document_id), include_chunks=True)


@router.patch("/documents/{document_id}")
def update_document(
    document_id: int, payload: DocumentUpdate,
    user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    document = get_document_or_404(session, document_id)
    if payload.expected_revision is not None and payload.expected_revision != document.revision:
        raise HTTPException(status_code=409, detail={"message": "文档已被修改，请刷新后重试。", "current_revision": document.revision})
    duplicate = session.scalar(select(Document).where(Document.slug == payload.slug, Document.id != document.id))
    if duplicate:
        raise HTTPException(status_code=409, detail="Document slug already exists")
    if payload.column_id and not session.get(KnowledgeColumn, payload.column_id):
        raise HTTPException(status_code=404, detail="Knowledge column not found")
    title = payload.title.strip()
    slug = payload.slug.strip()
    if not title or not slug:
        raise HTTPException(status_code=422, detail="标题和 URL 标识不能为空")
    save_document_version(session, document, user, "manual_save")
    document.title = title
    document.slug = slug
    document.summary = payload.summary.strip()
    document.visibility = payload.visibility
    document.allow_ai_search = payload.allow_ai_search
    document.column_id = payload.column_id
    document.metadata_json = json.dumps(payload.metadata, ensure_ascii=False)
    document.revision += 1
    record_activity(session, action="updated", entity_type="document", entity_id=document.id,
                    entity_title=document.title, actor_email=user)
    replace_document_nodes(session, document.id, payload.node_ids)
    session.flush()
    sync_document_vectors(session, document)
    session.commit()
    session.refresh(document)
    return document_dict(session, document, include_chunks=True)


@router.post("/documents/{document_id}/toggle")
def toggle_document(
    document_id: int, user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    document = get_document_or_404(session, document_id)
    if document.status not in {"ready", "disabled"}:
        raise HTTPException(status_code=409, detail="文档解析成功后才能启用或停用")
    save_document_version(session, document, user, "status_changed")
    document.status = "disabled" if document.status == "ready" else "ready"
    document.revision += 1
    session.flush()
    sync_document_vectors(session, document)
    session.commit()
    return document_dict(session, document, include_chunks=True)


@router.post("/documents/{document_id}/rechunk")
def rechunk_document(
    document_id: int, payload: DocumentRechunk,
    user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    document = get_document_or_404(session, document_id)
    file_path = Path(settings.upload_dir) / "documents" / document.stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Original document file is missing")
    save_document_version(session, document, user, "before_rechunk")
    document.chunk_size = payload.chunk_size
    document.chunk_overlap = min(payload.chunk_overlap, payload.chunk_size - 1)
    document.status = "processing"
    try:
        parse_and_rechunk(session, document, file_path)
    except Exception as error:
        session.rollback()
        document = get_document_or_404(session, document_id)
        document.status = "error"
        document.parse_error = str(error)[:2000]
        session.commit()
        raise HTTPException(status_code=422, detail=document.parse_error)
    document.revision += 1
    session.commit()
    return document_dict(session, document, include_chunks=True)


@router.patch("/document-chunks/{chunk_id}")
def update_document_chunk(
    chunk_id: int, payload: DocumentChunkUpdate,
    user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    chunk = session.get(DocumentChunk, chunk_id)
    if not chunk:
        raise HTTPException(status_code=404, detail="Document chunk not found")
    document = get_document_or_404(session, chunk.document_id)
    save_document_version(session, document, user, "chunk_edited")
    chunk.heading = payload.heading.strip()
    chunk.content = payload.content.strip()
    chunk.page_start = payload.page_start
    chunk.page_end = payload.page_end
    chunk.metadata_json = json.dumps(payload.metadata, ensure_ascii=False)
    chunk.is_enabled = payload.is_enabled
    update_chunk_embedding(chunk)
    document.revision += 1
    session.flush()
    sync_document_vectors(session, document)
    session.commit()
    session.refresh(chunk)
    return chunk_dict(chunk)


@router.get("/documents/{document_id}/versions")
def document_versions(document_id: int, _: str = Depends(require_admin), session: Session = Depends(get_session)) -> list[dict]:
    get_document_or_404(session, document_id)
    rows = session.scalars(select(ContentVersion).where(
        ContentVersion.entity_type == "document", ContentVersion.entity_id == document_id,
    ).order_by(ContentVersion.id.desc()))
    return [{"id": row.id, "reason": row.reason, "created_by_email": row.created_by_email, "created_at": row.created_at} for row in rows]


@router.get("/documents/versions/{version_id}/diff")
def document_version_diff(
    version_id: int, _: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    version = session.get(ContentVersion, version_id)
    if not version or version.entity_type != "document":
        raise HTTPException(status_code=404, detail="Document version not found")
    document = get_document_or_404(session, version.entity_id)
    old = json.loads(version.snapshot_json)
    current = document_snapshot(session, document)
    fields = [
        "title", "slug", "summary", "status", "visibility", "allow_ai_search",
        "column_id", "node_ids", "metadata", "chunk_size", "chunk_overlap", "chunks",
    ]
    changed = [field for field in fields if old.get(field) != current.get(field)]
    old_content = "\n\n".join(str(chunk.get("content") or "") for chunk in old.get("chunks") or [])
    current_content = "\n\n".join(str(chunk.get("content") or "") for chunk in current.get("chunks") or [])
    diff = difflib.unified_diff(
        old_content.splitlines(), current_content.splitlines(),
        fromfile=f"version-{version.id}", tofile="current", lineterm="",
    )
    return {"version_id": version.id, "reason": version.reason,
            "changed_fields": changed, "content_diff": "\n".join(diff)}


@router.post("/documents/versions/{version_id}/restore")
def restore_document_version(
    version_id: int, user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    version = session.get(ContentVersion, version_id)
    if not version or version.entity_type != "document":
        raise HTTPException(status_code=404, detail="Document version not found")
    document = get_document_or_404(session, version.entity_id)
    save_document_version(session, document, user, "before_restore")
    raw = json.loads(version.snapshot_json)
    for key in ["title", "slug", "summary", "status", "visibility", "allow_ai_search", "column_id", "raw_text", "parse_error", "chunk_size", "chunk_overlap"]:
        if key in raw:
            setattr(document, key, raw[key])
    document.metadata_json = json.dumps(raw.get("metadata") or {}, ensure_ascii=False)
    replace_document_nodes(session, document.id, raw.get("node_ids") or [])
    session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    restore_chunks(session, document, raw.get("chunks") or [])
    document.revision += 1
    sync_document_vectors(session, document)
    session.commit()
    return document_dict(session, document, include_chunks=True)


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int, user: str = Depends(require_admin), session: Session = Depends(get_session),
) -> dict:
    document = get_document_or_404(session, document_id)
    save_document_version(session, document, user, "trashed")
    delete_document_vectors(document.id)
    document.deleted_at = datetime.now(timezone.utc)
    document.status = "disabled"
    record_activity(session, action="trashed", entity_type="document", entity_id=document.id, entity_title=document.title, actor_email=user)
    session.commit()
    return {"status": "trashed"}
