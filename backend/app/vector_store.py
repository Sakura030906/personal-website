from dataclasses import dataclass
import os
from typing import Any

from .config import settings
from .models import ContentChunk, DocumentChunk, KnowledgeNodeChunk
from .search_utils import parse_embedding


@dataclass
class VectorHit:
    chunk_id: int
    score: float


def configured_vector_store() -> str:
    return settings.vector_store.strip().lower() or "local"


def _milvus_client():
    local_uri = not settings.milvus_uri.startswith(("http://", "https://"))
    original_env_uri = os.environ.pop("MILVUS_URI", None) if local_uri else None
    try:
        from pymilvus import MilvusClient
    except ImportError as error:
        raise RuntimeError("pymilvus is not installed") from error
    finally:
        if original_env_uri is not None:
            os.environ["MILVUS_URI"] = original_env_uri

    if settings.milvus_token and not local_uri:
        return MilvusClient(uri=settings.milvus_uri, token=settings.milvus_token)
    return MilvusClient(uri=settings.milvus_uri)


def _ensure_milvus_collection(client: Any, dimension: int, collection: str) -> None:
    if client.has_collection(collection_name=collection):
        return
    client.create_collection(
        collection_name=collection,
        dimension=dimension,
        primary_field_name="id",
        id_type="int",
        vector_field_name="vector",
        metric_type=settings.milvus_metric_type,
        auto_id=False,
    )


def upsert_chunks(chunks: list[ContentChunk]) -> dict[str, object]:
    if configured_vector_store() != "milvus" or not chunks:
        return {"store": configured_vector_store(), "upserted": 0, "status": "skipped"}

    rows = []
    dimension = 0
    for chunk in chunks:
        vector = parse_embedding(chunk.embedding_json)
        if not vector:
            continue
        dimension = dimension or len(vector)
        rows.append(
            {
                "id": chunk.id,
                "vector": vector,
                "entry_id": chunk.entry_id,
                "entity_type": chunk.entity_type,
                "slug": chunk.slug,
                "title": chunk.title[:255],
                "chunk_index": chunk.chunk_index,
            }
        )

    if not rows:
        return {"store": "milvus", "upserted": 0, "status": "empty"}

    try:
        client = _milvus_client()
        _ensure_milvus_collection(client, dimension, settings.milvus_collection)
        client.delete(collection_name=settings.milvus_collection, filter=f"entry_id == {chunks[0].entry_id}")
        client.insert(collection_name=settings.milvus_collection, data=rows)
        return {"store": "milvus", "upserted": len(rows), "status": "ok"}
    except Exception as error:  # Milvus errors vary by installed version.
        return {"store": "milvus", "upserted": 0, "status": "error", "error": str(error)}


def delete_entry_vectors(entry_id: int) -> dict[str, object]:
    if configured_vector_store() != "milvus":
        return {"store": configured_vector_store(), "deleted": 0, "status": "skipped"}
    try:
        client = _milvus_client()
        if client.has_collection(collection_name=settings.milvus_collection):
            client.delete(collection_name=settings.milvus_collection, filter=f"entry_id == {entry_id}")
        return {"store": "milvus", "deleted": 0, "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "deleted": 0, "status": "error", "error": str(error)}


def upsert_node_chunks(chunks: list[KnowledgeNodeChunk]) -> dict[str, object]:
    if configured_vector_store() != "milvus" or not chunks:
        return {"store": configured_vector_store(), "upserted": 0, "status": "skipped"}
    rows = []
    dimension = 0
    for chunk in chunks:
        vector = parse_embedding(chunk.embedding_json)
        if not vector:
            continue
        dimension = dimension or len(vector)
        rows.append({
            "id": chunk.id,
            "vector": vector,
            "node_id": chunk.node_id,
            "entity_type": "knowledge_node",
            "slug": chunk.slug,
            "title": chunk.title[:255],
            "chunk_index": chunk.chunk_index,
        })
    if not rows:
        return {"store": "milvus", "upserted": 0, "status": "empty"}
    try:
        client = _milvus_client()
        _ensure_milvus_collection(client, dimension, settings.milvus_node_collection)
        client.delete(collection_name=settings.milvus_node_collection, filter=f"node_id == {chunks[0].node_id}")
        client.insert(collection_name=settings.milvus_node_collection, data=rows)
        return {"store": "milvus", "upserted": len(rows), "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "upserted": 0, "status": "error", "error": str(error)}


def delete_node_vectors(node_id: int) -> dict[str, object]:
    if configured_vector_store() != "milvus":
        return {"store": configured_vector_store(), "deleted": 0, "status": "skipped"}
    try:
        client = _milvus_client()
        if client.has_collection(collection_name=settings.milvus_node_collection):
            client.delete(collection_name=settings.milvus_node_collection, filter=f"node_id == {node_id}")
        return {"store": "milvus", "deleted": 0, "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "deleted": 0, "status": "error", "error": str(error)}


def upsert_document_chunks(chunks: list[DocumentChunk]) -> dict[str, object]:
    if configured_vector_store() != "milvus" or not chunks:
        return {"store": configured_vector_store(), "upserted": 0, "status": "skipped"}
    rows = []
    dimension = 0
    for chunk in chunks:
        vector = parse_embedding(chunk.embedding_json)
        if not vector or not chunk.is_enabled:
            continue
        dimension = dimension or len(vector)
        rows.append({
            "id": chunk.id,
            "vector": vector,
            "document_id": chunk.document_id,
            "heading": chunk.heading[:255],
            "chunk_index": chunk.chunk_index,
            "page_start": chunk.page_start or 0,
        })
    try:
        client = _milvus_client()
        if rows:
            _ensure_milvus_collection(client, dimension, settings.milvus_document_collection)
        if client.has_collection(collection_name=settings.milvus_document_collection):
            client.delete(collection_name=settings.milvus_document_collection, filter=f"document_id == {chunks[0].document_id}")
        if rows:
            client.insert(collection_name=settings.milvus_document_collection, data=rows)
        return {"store": "milvus", "upserted": len(rows), "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "upserted": 0, "status": "error", "error": str(error)}


def delete_document_vectors(document_id: int) -> dict[str, object]:
    if configured_vector_store() != "milvus":
        return {"store": configured_vector_store(), "deleted": 0, "status": "skipped"}
    try:
        client = _milvus_client()
        if client.has_collection(collection_name=settings.milvus_document_collection):
            client.delete(collection_name=settings.milvus_document_collection, filter=f"document_id == {document_id}")
        return {"store": "milvus", "deleted": 0, "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "deleted": 0, "status": "error", "error": str(error)}


def reset_vector_store() -> dict[str, object]:
    if configured_vector_store() != "milvus":
        return {"store": configured_vector_store(), "status": "skipped"}
    try:
        client = _milvus_client()
        if client.has_collection(collection_name=settings.milvus_collection):
            client.drop_collection(collection_name=settings.milvus_collection)
        return {"store": "milvus", "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "status": "error", "error": str(error)}


def reset_node_vector_store() -> dict[str, object]:
    if configured_vector_store() != "milvus":
        return {"store": configured_vector_store(), "status": "skipped"}
    try:
        client = _milvus_client()
        if client.has_collection(collection_name=settings.milvus_node_collection):
            client.drop_collection(collection_name=settings.milvus_node_collection)
        return {"store": "milvus", "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "status": "error", "error": str(error)}


def reset_document_vector_store() -> dict[str, object]:
    if configured_vector_store() != "milvus":
        return {"store": configured_vector_store(), "status": "skipped"}
    try:
        client = _milvus_client()
        if client.has_collection(collection_name=settings.milvus_document_collection):
            client.drop_collection(collection_name=settings.milvus_document_collection)
        return {"store": "milvus", "status": "ok"}
    except Exception as error:
        return {"store": "milvus", "status": "error", "error": str(error)}


def search_vector_store(query_vector: list[float], limit: int) -> list[VectorHit]:
    if configured_vector_store() != "milvus":
        return []
    try:
        client = _milvus_client()
        if not client.has_collection(collection_name=settings.milvus_collection):
            return []
        results = client.search(
            collection_name=settings.milvus_collection,
            data=[query_vector],
            limit=max(1, limit),
            output_fields=["entry_id", "slug", "title", "chunk_index"],
            search_params={"metric_type": settings.milvus_metric_type},
        )
    except Exception:
        return []

    hits = []
    for hit in (results[0] if results else []):
        entity = hit.get("entity") if isinstance(hit, dict) else getattr(hit, "entity", {})
        chunk_id = None
        if isinstance(hit, dict):
            chunk_id = hit.get("id") or hit.get("pk")
            score = hit.get("distance", hit.get("score", 0))
        else:
            chunk_id = getattr(hit, "id", None) or getattr(hit, "pk", None)
            score = getattr(hit, "distance", 0)
        if not chunk_id and isinstance(entity, dict):
            chunk_id = entity.get("id")
        try:
            hits.append(VectorHit(chunk_id=int(chunk_id), score=float(score or 0)))
        except (TypeError, ValueError):
            continue
    return hits


def search_node_vector_store(query_vector: list[float], limit: int) -> list[VectorHit]:
    if configured_vector_store() != "milvus":
        return []
    try:
        client = _milvus_client()
        if not client.has_collection(collection_name=settings.milvus_node_collection):
            return []
        results = client.search(
            collection_name=settings.milvus_node_collection,
            data=[query_vector],
            limit=max(1, limit),
            output_fields=["node_id", "slug", "title", "chunk_index"],
            search_params={"metric_type": settings.milvus_metric_type},
        )
    except Exception:
        return []
    hits = []
    for hit in (results[0] if results else []):
        if isinstance(hit, dict):
            chunk_id = hit.get("id") or hit.get("pk")
            score = hit.get("distance", hit.get("score", 0))
        else:
            chunk_id = getattr(hit, "id", None) or getattr(hit, "pk", None)
            score = getattr(hit, "distance", 0)
        try:
            hits.append(VectorHit(chunk_id=int(chunk_id), score=float(score or 0)))
        except (TypeError, ValueError):
            continue
    return hits


def search_document_vector_store(query_vector: list[float], limit: int) -> list[VectorHit]:
    if configured_vector_store() != "milvus":
        return []
    try:
        client = _milvus_client()
        if not client.has_collection(collection_name=settings.milvus_document_collection):
            return []
        results = client.search(
            collection_name=settings.milvus_document_collection,
            data=[query_vector],
            limit=max(1, limit),
            output_fields=["document_id", "heading", "chunk_index", "page_start"],
            search_params={"metric_type": settings.milvus_metric_type},
        )
    except Exception:
        return []
    hits = []
    for hit in (results[0] if results else []):
        if isinstance(hit, dict):
            chunk_id = hit.get("id") or hit.get("pk")
            score = hit.get("distance", hit.get("score", 0))
        else:
            chunk_id = getattr(hit, "id", None) or getattr(hit, "pk", None)
            score = getattr(hit, "distance", 0)
        try:
            hits.append(VectorHit(chunk_id=int(chunk_id), score=float(score or 0)))
        except (TypeError, ValueError):
            continue
    return hits


def vector_store_status() -> dict[str, object]:
    store = configured_vector_store()
    if store != "milvus":
        return {"configured": store, "active": "local", "status": "local"}
    try:
        client = _milvus_client()
        exists = client.has_collection(collection_name=settings.milvus_collection)
        stats = client.get_collection_stats(collection_name=settings.milvus_collection) if exists else {}
        content_count = 0
        if exists:
            rows = client.query(
                collection_name=settings.milvus_collection,
                filter="",
                output_fields=["count(*)"],
            )
            content_count = int(rows[0].get("count(*)", 0)) if rows else 0
        node_exists = client.has_collection(collection_name=settings.milvus_node_collection)
        node_count = 0
        if node_exists:
            rows = client.query(
                collection_name=settings.milvus_node_collection,
                filter="",
                output_fields=["count(*)"],
            )
            node_count = int(rows[0].get("count(*)", 0)) if rows else 0
        document_exists = client.has_collection(collection_name=settings.milvus_document_collection)
        document_count = 0
        if document_exists:
            rows = client.query(
                collection_name=settings.milvus_document_collection,
                filter="",
                output_fields=["count(*)"],
            )
            document_count = int(rows[0].get("count(*)", 0)) if rows else 0
        return {
            "configured": "milvus",
            "active": "milvus",
            "status": "ok",
            "uri": settings.milvus_uri,
            "collection": settings.milvus_collection,
            "exists": exists,
            "stats": stats,
            "row_count": content_count,
            "node_collection": settings.milvus_node_collection,
            "node_exists": node_exists,
            "node_row_count": node_count,
            "document_collection": settings.milvus_document_collection,
            "document_exists": document_exists,
            "document_row_count": document_count,
        }
    except Exception as error:
        return {
            "configured": "milvus",
            "active": "local",
            "status": "fallback",
            "uri": settings.milvus_uri,
            "collection": settings.milvus_collection,
            "error": str(error),
        }
