from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import settings
from .document_rag import sync_document_index
from .embeddings import embed_texts
from .knowledge_service import payload_hash
from .models import ContentVersion, Document, DocumentChunk, DocumentNode, KnowledgeColumn, KnowledgeNode
from .vector_store import delete_document_vectors


SUPPORTED_DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".md", ".markdown", ".txt"}


@dataclass
class TextSection:
    heading: str
    text: str
    page_start: int | None = None
    page_end: int | None = None


def parser_name(path: Path) -> str:
    suffix = path.suffix.lower()
    return {".pdf": "pypdf", ".docx": "python-docx", ".md": "markdown", ".markdown": "markdown"}.get(suffix, "text")


def extract_sections(path: Path) -> list[TextSection]:
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_DOCUMENT_EXTENSIONS:
        raise ValueError(f"Unsupported document type: {suffix or 'unknown'}")
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        sections = []
        for index, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                sections.append(TextSection(f"第 {index} 页", text, index, index))
        return sections
    if suffix == ".docx":
        from docx import Document as DocxDocument

        document = DocxDocument(str(path))
        sections: list[TextSection] = []
        heading = "正文"
        buffer: list[str] = []
        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            if paragraph.style and paragraph.style.name.lower().startswith("heading"):
                if buffer:
                    sections.append(TextSection(heading, "\n".join(buffer)))
                    buffer = []
                heading = text
            else:
                buffer.append(text)
        if buffer:
            sections.append(TextSection(heading, "\n".join(buffer)))
        return sections

    text = path.read_text(encoding="utf-8-sig", errors="replace").strip()
    if suffix in {".md", ".markdown"}:
        sections = []
        heading = "正文"
        buffer = []
        for line in text.splitlines():
            match = re.match(r"^#{1,6}\s+(.+)$", line.strip())
            if match:
                if buffer and "\n".join(buffer).strip():
                    sections.append(TextSection(heading, "\n".join(buffer).strip()))
                heading = match.group(1).strip()
                buffer = []
            else:
                buffer.append(line)
        if buffer and "\n".join(buffer).strip():
            sections.append(TextSection(heading, "\n".join(buffer).strip()))
        return sections or [TextSection("正文", text)]
    return [TextSection("正文", text)] if text else []


def split_sections(sections: list[TextSection], chunk_size: int, overlap: int) -> list[TextSection]:
    size = max(200, chunk_size)
    safe_overlap = max(0, min(overlap, size - 1))
    chunks: list[TextSection] = []
    for section in sections:
        text = "\n".join(line.rstrip() for line in section.text.splitlines()).strip()
        start = 0
        while start < len(text):
            end = min(start + size, len(text))
            chunks.append(TextSection(section.heading, text[start:end].strip(), section.page_start, section.page_end))
            if end >= len(text):
                break
            start = end - safe_overlap
    return [chunk for chunk in chunks if chunk.text]


def parse_metadata(raw: str | None) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def document_snapshot(session: Session, document: Document) -> dict:
    return {
        "title": document.title,
        "slug": document.slug,
        "summary": document.summary,
        "status": document.status,
        "visibility": document.visibility,
        "allow_ai_search": document.allow_ai_search,
        "column_id": document.column_id,
        "node_ids": list(session.scalars(select(DocumentNode.node_id).where(DocumentNode.document_id == document.id))),
        "metadata": parse_metadata(document.metadata_json),
        "raw_text": document.raw_text,
        "parse_error": document.parse_error,
        "chunk_size": document.chunk_size,
        "chunk_overlap": document.chunk_overlap,
        "chunks": [
            {
                "heading": chunk.heading,
                "content": chunk.content,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "metadata": parse_metadata(chunk.metadata_json),
                "is_enabled": chunk.is_enabled,
            }
            for chunk in session.scalars(select(DocumentChunk).where(DocumentChunk.document_id == document.id).order_by(DocumentChunk.chunk_index))
        ],
    }


def save_document_version(session: Session, document: Document, user: str, reason: str) -> None:
    snapshot = document_snapshot(session, document)
    session.add(ContentVersion(
        entity_type="document",
        entity_id=document.id,
        snapshot_json=json.dumps(snapshot, ensure_ascii=False, sort_keys=True),
        snapshot_hash=payload_hash(snapshot),
        reason=reason,
        created_by_email=user,
    ))


def replace_document_nodes(session: Session, document_id: int, node_ids: list[int]) -> None:
    session.execute(delete(DocumentNode).where(DocumentNode.document_id == document_id))
    unique_ids = list(dict.fromkeys(node_ids))
    valid_ids = set(session.scalars(select(KnowledgeNode.id).where(KnowledgeNode.id.in_(unique_ids)))) if unique_ids else set()
    for node_id in unique_ids:
        if node_id in valid_ids:
            session.add(DocumentNode(document_id=document_id, node_id=node_id))


def create_chunks(session: Session, document: Document, sections: list[TextSection]) -> int:
    chunks = split_sections(sections, document.chunk_size, document.chunk_overlap)
    embeddings = embed_texts([chunk.text for chunk in chunks])
    for index, section in enumerate(chunks):
        result = embeddings[index]
        session.add(DocumentChunk(
            document_id=document.id,
            chunk_index=index,
            heading=section.heading[:255],
            content=section.text,
            page_start=section.page_start,
            page_end=section.page_end,
            metadata_json=json.dumps({"document_slug": document.slug}, ensure_ascii=False),
            is_enabled=True,
            embedding_json=json.dumps(result.vector),
            embedding_provider=result.provider,
            embedding_model=result.model,
            embedding_dimensions=result.dimensions,
            token_count=len(section.text.split()),
            content_hash=hashlib.sha256(section.text.encode("utf-8")).hexdigest(),
        ))
    session.flush()
    return len(chunks)


def restore_chunks(session: Session, document: Document, snapshots: list[dict]) -> int:
    contents = [str(item.get("content") or "").strip() for item in snapshots]
    valid_items = [(item, content) for item, content in zip(snapshots, contents) if content]
    embeddings = embed_texts([content for _, content in valid_items])
    for index, ((item, content), result) in enumerate(zip(valid_items, embeddings)):
        session.add(DocumentChunk(
            document_id=document.id,
            chunk_index=index,
            heading=str(item.get("heading") or "")[:255],
            content=content,
            page_start=item.get("page_start"),
            page_end=item.get("page_end"),
            metadata_json=json.dumps(item.get("metadata") or {}, ensure_ascii=False),
            is_enabled=bool(item.get("is_enabled", True)),
            embedding_json=json.dumps(result.vector),
            embedding_provider=result.provider,
            embedding_model=result.model,
            embedding_dimensions=result.dimensions,
            token_count=len(content.split()),
            content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
        ))
    session.flush()
    return len(valid_items)


def parse_and_rechunk(session: Session, document: Document, file_path: Path) -> int:
    delete_document_vectors(document.id)
    session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    sections = extract_sections(file_path)
    if not sections:
        raise ValueError("No readable text was extracted from this document")
    document.raw_text = "\n\n".join(section.text for section in sections)
    document.parser = parser_name(file_path)
    document.parse_error = ""
    count = create_chunks(session, document, sections)
    document.status = "ready"
    session.flush()
    sync_document_vectors(session, document)
    return count


def sync_document_vectors(session: Session, document: Document) -> dict[str, object]:
    result = sync_document_index(session, document)
    if settings.vector_store.strip().lower() == "milvus" and result.get("status") != "ok":
        raise RuntimeError(f"Milvus document sync failed: {result.get('error') or result.get('status')}")
    return result


def update_chunk_embedding(chunk: DocumentChunk) -> None:
    result = embed_texts([chunk.content])[0]
    chunk.embedding_json = json.dumps(result.vector)
    chunk.embedding_provider = result.provider
    chunk.embedding_model = result.model
    chunk.embedding_dimensions = result.dimensions
    chunk.token_count = len(chunk.content.split())
    chunk.content_hash = hashlib.sha256(chunk.content.encode("utf-8")).hexdigest()


def document_dict(session: Session, document: Document, include_chunks: bool = False) -> dict:
    node_rows = session.execute(
        select(KnowledgeNode.id, KnowledgeNode.title, KnowledgeNode.slug)
        .join(DocumentNode, DocumentNode.node_id == KnowledgeNode.id)
        .where(DocumentNode.document_id == document.id)
        .order_by(KnowledgeNode.title)
    ).all()
    chunk_count = session.scalar(select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == document.id)) or 0
    enabled_count = session.scalar(select(func.count(DocumentChunk.id)).where(
        DocumentChunk.document_id == document.id, DocumentChunk.is_enabled.is_(True),
    )) or 0
    column = session.get(KnowledgeColumn, document.column_id) if document.column_id else None
    payload = {
        "id": document.id, "title": document.title, "slug": document.slug, "summary": document.summary,
        "original_filename": document.original_filename, "content_type": document.content_type,
        "size_bytes": document.size_bytes, "file_url": document.file_url, "parser": document.parser,
        "status": document.status, "visibility": document.visibility, "allow_ai_search": document.allow_ai_search,
        "column_id": document.column_id,
        "column": {"id": column.id, "name": column.name, "slug": column.slug} if column else None,
        "node_ids": [row.id for row in node_rows],
        "nodes": [{"id": row.id, "title": row.title, "slug": row.slug} for row in node_rows],
        "metadata": parse_metadata(document.metadata_json), "parse_error": document.parse_error,
        "chunk_size": document.chunk_size, "chunk_overlap": document.chunk_overlap,
        "chunk_count": chunk_count, "enabled_chunk_count": enabled_count, "revision": document.revision,
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "updated_at": document.updated_at.isoformat() if document.updated_at else "",
    }
    if include_chunks:
        payload["chunks"] = [chunk_dict(chunk) for chunk in session.scalars(
            select(DocumentChunk).where(DocumentChunk.document_id == document.id).order_by(DocumentChunk.chunk_index)
        )]
    return payload


def chunk_dict(chunk: DocumentChunk) -> dict:
    return {
        "id": chunk.id, "document_id": chunk.document_id, "chunk_index": chunk.chunk_index,
        "heading": chunk.heading, "content": chunk.content, "page_start": chunk.page_start,
        "page_end": chunk.page_end, "metadata": parse_metadata(chunk.metadata_json),
        "is_enabled": chunk.is_enabled, "token_count": chunk.token_count,
        "embedding_provider": chunk.embedding_provider, "embedding_model": chunk.embedding_model,
        "embedding_dimensions": chunk.embedding_dimensions, "content_hash": chunk.content_hash,
        "updated_at": chunk.updated_at.isoformat() if chunk.updated_at else "",
    }
