import json
from dataclasses import dataclass
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .knowledge_rag import get_public_knowledge_node, search_knowledge_nodes
from .models import AiMemory, ContentEntry
from .search import search_entries


@dataclass
class AgentToolContext:
    session: Session
    session_id: str
    scope: str = "public"


@dataclass
class AgentTool:
    name: str
    description: str
    scope: str
    input_schema: dict
    requires_confirmation: bool
    handler: Callable[[AgentToolContext, dict], dict]


TOOLS: dict[str, AgentTool] = {}


def register_tool(
    name: str,
    description: str,
    input_schema: dict,
    scope: str = "public",
    requires_confirmation: bool = False,
):
    def decorator(handler: Callable[[AgentToolContext, dict], dict]):
        TOOLS[name] = AgentTool(
            name=name,
            description=description,
            scope=scope,
            input_schema=input_schema,
            requires_confirmation=requires_confirmation,
            handler=handler,
        )
        return handler

    return decorator


def public_entry(entry: ContentEntry, include_content: bool = False) -> dict:
    payload = {
        "id": entry.id,
        "entity_type": entry.entity_type,
        "slug": entry.slug,
        "title": entry.title,
        "summary": entry.summary,
        "category": entry.category,
        "status": entry.status,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else "",
    }
    if include_content:
        payload["content"] = entry.content_md
        try:
            metadata = json.loads(entry.metadata_json or "{}")
        except json.JSONDecodeError:
            metadata = {}
        payload["metadata"] = metadata if isinstance(metadata, dict) else {}
    return payload


def normalized_source_key(value: str) -> str:
    return "".join(character.lower() for character in (value or "") if character.isalnum())


@register_tool(
    "search_content",
    "在已发布文章、知识库、项目和阅读记录中执行混合检索。",
    {"query": "string", "limit": "integer?"},
)
def search_content(context: AgentToolContext, arguments: dict) -> dict:
    query = str(arguments.get("query") or "").strip()
    limit = max(1, min(int(arguments.get("limit") or 5), 10))
    if not query:
        return {"query": query, "results": [], "count": 0}
    ranked = search_entries(context.session, query, limit=limit, published_only=True)
    results = []
    for item in ranked:
        result = public_entry(item.entry)
        result.update(
            {
                "score": round(item.score, 4),
                "matched_chunk": (item.chunk_text or item.entry.summary)[:500],
                "retrieval_store": item.retrieval_store,
            }
        )
        results.append(result)
    node_hits = search_knowledge_nodes(context.session, query, limit=limit) if hasattr(context.session, "scalars") else []
    for hit in node_hits:
        results.append({
            **hit.payload,
            "score": round(hit.score, 4),
            "matched_chunk": hit.payload["context"][:700],
            "retrieval_store": hit.retrieval_store,
        })
    node_keys = {
        normalized_source_key(value)
        for item in results
        if item.get("entity_type") == "knowledge_node"
        for value in (item.get("slug"), item.get("title"))
        if value
    }
    results = [
        item for item in results
        if not (
            item.get("entity_type") == "knowledge"
            and any(normalized_source_key(value) in node_keys for value in (item.get("slug"), item.get("title")) if value)
        )
    ]
    results.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
    results = results[:limit]
    return {"query": query, "results": results, "count": len(results)}


@register_tool(
    "list_recent_content",
    "按更新时间列出最近发布的站内内容，可选文章、知识库、项目或阅读类型。",
    {"limit": "integer?", "entity_type": "string?"},
)
def list_recent_content(context: AgentToolContext, arguments: dict) -> dict:
    limit = max(1, min(int(arguments.get("limit") or 5), 10))
    entity_type = str(arguments.get("entity_type") or "").strip()
    statement = select(ContentEntry).where(
        ContentEntry.status == "published",
        ContentEntry.deleted_at.is_(None),
    )
    statement = statement.where(ContentEntry.entity_type != "knowledge")
    if entity_type:
        statement = statement.where(ContentEntry.entity_type == entity_type)
    entries = list(
        context.session.scalars(
            statement.order_by(ContentEntry.updated_at.desc(), ContentEntry.id.desc()).limit(limit)
        )
    )
    return {
        "entity_type": entity_type,
        "results": [public_entry(entry) for entry in entries],
        "count": len(entries),
    }


@register_tool(
    "get_content",
    "按 slug 和可选内容类型读取一条已发布内容的完整正文与元数据。",
    {"slug": "string", "entity_type": "string?"},
)
def get_content(context: AgentToolContext, arguments: dict) -> dict:
    slug = str(arguments.get("slug") or "").strip()
    entity_type = str(arguments.get("entity_type") or "").strip()
    if entity_type == "knowledge_node":
        node = get_public_knowledge_node(context.session, slug)
        return {"found": bool(node), "content": node}
    statement = select(ContentEntry).where(
        ContentEntry.slug == slug,
        ContentEntry.status == "published",
        ContentEntry.deleted_at.is_(None),
    )
    statement = statement.where(ContentEntry.entity_type != "knowledge")
    if entity_type:
        statement = statement.where(ContentEntry.entity_type == entity_type)
    entry = context.session.scalar(statement)
    if entry:
        return {"found": True, "content": public_entry(entry, include_content=True)}
    node = get_public_knowledge_node(context.session, slug) if not entity_type else None
    return {"found": bool(node), "content": node}


@register_tool(
    "compare_content",
    "按 slug 一次读取并对比两到三条已发布内容，适合技术选型和差异分析。",
    {"slugs": "array", "entity_type": "string?"},
)
def compare_content(context: AgentToolContext, arguments: dict) -> dict:
    slugs = [str(value).strip() for value in arguments.get("slugs") or [] if str(value).strip()][:3]
    entity_type = str(arguments.get("entity_type") or "").strip()
    if len(slugs) < 2:
        return {"found": 0, "requested": slugs, "items": []}
    statement = select(ContentEntry).where(
        ContentEntry.slug.in_(slugs),
        ContentEntry.status == "published",
        ContentEntry.entity_type != "knowledge",
        ContentEntry.deleted_at.is_(None),
    )
    if entity_type:
        statement = statement.where(ContentEntry.entity_type == entity_type)
    entries = {entry.slug: entry for entry in context.session.scalars(statement)}
    items = [public_entry(entries[slug], include_content=True) for slug in slugs if slug in entries]
    return {"found": len(items), "requested": slugs, "items": items}


@register_tool(
    "explore_knowledge_graph",
    "读取内容元数据中的知识、项目、文章和阅读双向关联。",
    {"slug": "string", "entity_type": "string?"},
)
def explore_knowledge_graph(context: AgentToolContext, arguments: dict) -> dict:
    content_result = get_content(context, arguments)
    entry = content_result.get("content")
    if not entry:
        return {"found": False, "source": None, "relations": {}}
    if entry.get("entity_type") == "knowledge_node":
        relations = {
            "nodes": entry.get("graph_relations", []),
            "related_node_slugs": entry.get("related_node_slugs", []),
            "articles": [article.get("slug") for article in entry.get("articles", []) if article.get("slug")],
            "columns": entry.get("columns", []),
            "tags": entry.get("tags", []),
        }
        return {
            "found": True,
            "source": {key: entry[key] for key in ["entity_type", "slug", "title"]},
            "relations": relations,
            "relation_count": len(entry.get("relations", [])),
        }
    metadata = entry.get("metadata") or {}
    relations = {
        "knowledge": metadata.get("relatedKnowledge", []),
        "projects": metadata.get("relatedProjects", []),
        "posts": metadata.get("relatedPosts", []),
        "reading": metadata.get("relatedReading", []),
        "links": metadata.get("noteLinks", []),
    }
    return {
        "found": True,
        "source": {key: entry[key] for key in ["entity_type", "slug", "title"]},
        "relations": relations,
        "relation_count": sum(len(value) for value in relations.values() if isinstance(value, list)),
    }


@register_tool(
    "recall_memory",
    "读取当前会话最近的 AI Memory，用于延续用户之前的上下文。",
    {"query": "string?", "limit": "integer?"},
)
def recall_memory(context: AgentToolContext, arguments: dict) -> dict:
    query = str(arguments.get("query") or "").strip().lower()
    limit = max(1, min(int(arguments.get("limit") or 5), 10))
    memories = list(
        context.session.scalars(
            select(AiMemory)
            .where(AiMemory.session_id == context.session_id)
            .order_by(AiMemory.created_at.desc(), AiMemory.id.desc())
            .limit(30)
        )
    )
    if query:
        tokens = [token for token in query.replace("？", " ").replace("?", " ").split() if len(token) >= 2]
        matching = [
            memory
            for memory in memories
            if not tokens or any(token in f"{memory.question} {memory.answer}".lower() for token in tokens)
        ]
        memories = matching or memories
    items = [
        {
            "id": memory.id,
            "question": memory.question,
            "answer": memory.answer[:1000],
            "source_slugs": json.loads(memory.source_slugs or "[]"),
            "created_at": memory.created_at.isoformat() if memory.created_at else "",
        }
        for memory in memories[:limit]
    ]
    return {"query": query, "memories": items, "count": len(items)}


def list_tools(scope: str = "public") -> list[AgentTool]:
    return [tool for tool in TOOLS.values() if tool.scope == "public" or scope == "admin"]


def get_tool(name: str) -> AgentTool | None:
    return TOOLS.get(name)


def execute_tool(name: str, context: AgentToolContext, arguments: dict) -> dict:
    tool = TOOLS.get(name)
    if not tool:
        raise ValueError(f"Unknown tool: {name}")
    if context.scope != "admin" and tool.scope != "public":
        raise PermissionError(f"Tool is not available in {context.scope} scope: {name}")
    sanitized = {}
    for key, type_name in tool.input_schema.items():
        type_label = str(type_name)
        optional = type_label.endswith("?")
        value = arguments.get(key)
        if not optional and (value is None or value == ""):
            raise ValueError(f"Missing required tool input: {key}")
        if isinstance(value, str):
            value = value[:2000]
        if type_label.rstrip("?") == "array":
            if not isinstance(value, list):
                raise ValueError(f"Tool input must be an array: {key}")
            value = [str(item)[:300] for item in value[:10]]
        sanitized[key] = value
    return tool.handler(context, sanitized)
