import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import Session

from .article_service import slugify
from .models import (
    ActivityEvent,
    Article,
    ArticleColumn,
    ArticleNode,
    ContentEntry,
    Document,
    DocumentNode,
    InboxItem,
    KnowledgeColumn,
    KnowledgeColumnNode,
    KnowledgeNode,
    KnowledgeRelation,
    ReviewState,
)
from .schemas import ReviewAction

ENTITY_MODELS = {
    "entry": ContentEntry,
    "article": Article,
    "knowledge_node": KnowledgeNode,
    "knowledge_column": KnowledgeColumn,
    "document": Document,
    "inbox": InboxItem,
}


def inbox_dict(item: InboxItem) -> dict:
    return {
        "id": item.id, "title": item.title, "body": item.body, "source_url": item.source_url,
        "item_type": item.item_type, "status": item.status, "visibility": item.visibility,
        "target_entity_type": item.target_entity_type, "target_entity_id": item.target_entity_id,
        "created_by_email": item.created_by_email, "created_at": item.created_at,
        "updated_at": item.updated_at, "processed_at": item.processed_at,
    }


def unique_entry_slug(session: Session, value: str, entity_type: str, model=ContentEntry) -> str:
    base = slugify(value) or f"capture-{int(datetime.now().timestamp())}"
    candidate = base
    suffix = 2
    def exists(slug: str) -> bool:
        if model is ContentEntry:
            return bool(session.scalar(select(ContentEntry).where(ContentEntry.entity_type == entity_type, ContentEntry.slug == slug)))
        return bool(session.scalar(select(model).where(model.slug == slug)))
    while exists(candidate):
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def active_rows(session: Session, model) -> list:
    return list(session.scalars(select(model).where(model.deleted_at.is_(None))))


def organization_payload(session: Session) -> dict:
    columns = active_rows(session, KnowledgeColumn)
    nodes = active_rows(session, KnowledgeNode)
    articles = active_rows(session, Article)
    documents = active_rows(session, Document)
    projects = list(session.scalars(select(ContentEntry).where(
        ContentEntry.deleted_at.is_(None), ContentEntry.entity_type == "project",
    )))
    entities = {
        **{("knowledge_column", row.id): {"id": row.id, "entity_type": "knowledge_column", "title": row.name, "slug": row.slug, "summary": row.description, "visibility": row.visibility, "updated_at": row.updated_at, "connections": 0} for row in columns},
        **{("knowledge_node", row.id): {"id": row.id, "entity_type": "knowledge_node", "title": row.title, "slug": row.slug, "summary": row.summary, "visibility": row.visibility, "updated_at": row.updated_at, "connections": 0} for row in nodes},
        **{("article", row.id): {"id": row.id, "entity_type": "article", "title": row.title, "slug": row.slug, "summary": row.summary, "visibility": row.visibility, "updated_at": row.updated_at, "connections": 0} for row in articles},
        **{("document", row.id): {"id": row.id, "entity_type": "document", "title": row.title, "slug": row.slug, "summary": row.summary, "visibility": row.visibility, "updated_at": row.updated_at, "connections": 0} for row in documents},
        **{("project", row.id): {"id": row.id, "entity_type": "project", "title": row.title, "slug": row.slug, "summary": row.summary, "visibility": row.visibility, "updated_at": row.updated_at, "connections": 0} for row in projects},
    }
    links: list[dict] = []

    def add_link(source_type: str, source_id: int, target_type: str, target_id: int, relation_type: str, relation_id: int | None = None) -> None:
        source = entities.get((source_type, source_id))
        target = entities.get((target_type, target_id))
        if not source or not target:
            return
        source["connections"] += 1
        target["connections"] += 1
        links.append({
            "id": relation_id, "source_type": source_type, "source_id": source_id,
            "source_title": source["title"], "target_type": target_type, "target_id": target_id,
            "target_title": target["title"], "relation_type": relation_type,
        })

    for row in session.scalars(select(KnowledgeColumnNode)):
        add_link("knowledge_column", row.column_id, "knowledge_node", row.node_id, "contains")
    for row in session.scalars(select(ArticleColumn)):
        add_link("knowledge_column", row.column_id, "article", row.article_id, "contains")
    for document in documents:
        if document.column_id:
            add_link("knowledge_column", document.column_id, "document", document.id, "contains")
    for row in session.scalars(select(ArticleNode)):
        add_link("article", row.article_id, "knowledge_node", row.node_id, row.relation_type or "references")
    for row in session.scalars(select(DocumentNode)):
        add_link("document", row.document_id, "knowledge_node", row.node_id, "references")
    for row in session.scalars(select(KnowledgeRelation).where(KnowledgeRelation.is_active.is_(True))):
        add_link("knowledge_node", row.source_node_id, "knowledge_node", row.target_node_id, row.relation_type, row.id)

    entity_rows = sorted(entities.values(), key=lambda item: (item["connections"] == 0, item["entity_type"], item["title"].lower()))
    orphans = [item for item in entity_rows if item["connections"] == 0]
    return {
        "stats": {
            "entities": len(entity_rows), "relations": len(links), "orphans": len(orphans),
            "columns": len(columns), "articles": len(articles), "nodes": len(nodes), "documents": len(documents), "projects": len(projects),
        },
        "entities": entity_rows,
        "links": links,
        "orphans": orphans,
    }


def aware_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def workspace_route(entity_type: str) -> str:
    return {
        "article": "articles",
        "knowledge_node": "knowledge-nodes",
        "knowledge_column": "knowledge-columns",
        "document": "documents",
        "project": "projects",
    }.get(entity_type, "review")


def search_score(query: str, title: str, slug: str, summary: str, content: str = "") -> int:
    needle = query.casefold().strip()
    if not needle:
        return 1
    title_value = (title or "").casefold()
    slug_value = (slug or "").casefold()
    summary_value = (summary or "").casefold()
    content_value = (content or "").casefold()
    score = 0
    if title_value == needle:
        score += 120
    elif title_value.startswith(needle):
        score += 80
    elif needle in title_value:
        score += 60
    if needle in slug_value:
        score += 35
    if needle in summary_value:
        score += 24
    if needle in content_value:
        score += 10
    for token in (part for part in needle.split() if len(part) > 1):
        if token in title_value:
            score += 12
        elif token in summary_value or token in content_value:
            score += 4
    return score


def review_state_payload(state: ReviewState, entity: dict | None = None) -> dict:
    return {
        "id": state.id,
        "entity_type": state.entity_type,
        "entity_id": state.entity_id,
        "status": state.status,
        "note": state.note,
        "interval_days": state.interval_days,
        "repetitions": state.repetitions,
        "last_reviewed_at": state.last_reviewed_at,
        "next_review_at": state.next_review_at,
        "updated_at": state.updated_at,
        "entity": entity,
    }


def text_features(value: str) -> set[str]:
    normalized = re.sub(r"\s+", " ", (value or "").casefold()).strip()
    words = {token for token in re.findall(r"[a-z0-9][a-z0-9._+-]{1,}", normalized)}
    chinese = "".join(re.findall(r"[\u4e00-\u9fff]", normalized))
    words.update(chinese[index:index + 2] for index in range(max(0, len(chinese) - 1)))
    return words


def content_similarity(left: dict, right: dict) -> float:
    left_terms = text_features(f"{left.get('title', '')} {left.get('summary', '')}")
    right_terms = text_features(f"{right.get('title', '')} {right.get('summary', '')}")
    if not left_terms or not right_terms:
        return 0.0
    return len(left_terms & right_terms) / len(left_terms | right_terms)


def apply_review_action(state: ReviewState, payload: ReviewAction, now: datetime) -> str:
    state.interval_days = payload.interval_days
    if payload.note.strip() or not state.note:
        state.note = payload.note.strip()
    if payload.action == "queue":
        state.status = "pending"
        state.next_review_at = now
        return "scheduled"
    if payload.action == "snooze":
        state.status = "scheduled"
        state.next_review_at = now + timedelta(days=payload.interval_days)
        return "scheduled"
    state.status = "scheduled"
    state.last_reviewed_at = now
    state.next_review_at = now + timedelta(days=payload.interval_days)
    state.repetitions += 1
    return "reviewed"


def weekly_report_payload(session: Session, days: int, now: datetime) -> dict:
    window_days = max(7, min(days, 90))
    start_date = now.date() - timedelta(days=window_days - 1)
    events = [
        event for event in session.scalars(select(ActivityEvent).order_by(ActivityEvent.id.desc()).limit(5000))
        if aware_datetime(event.created_at) and aware_datetime(event.created_at).date() >= start_date
    ]
    actions = Counter(event.action for event in events)
    entity_types = Counter(event.entity_type for event in events if event.entity_type)
    daily = defaultdict(Counter)
    touched: set[tuple[str, int]] = set()
    titles = Counter()
    for event in events:
        day = aware_datetime(event.created_at).date().isoformat()
        daily[day]["total"] += 1
        if event.action == "captured":
            daily[day]["captured"] += 1
        if event.action in {"created", "promoted"}:
            daily[day]["created"] += 1
        if event.action in {"updated", "published", "archived", "restored"}:
            daily[day]["changed"] += 1
        if event.action == "reviewed":
            daily[day]["reviewed"] += 1
        if event.entity_id is not None:
            touched.add((event.entity_type, event.entity_id))
        if event.entity_title:
            titles[event.entity_title] += 1

    trend = []
    for offset in range(window_days):
        current = start_date + timedelta(days=offset)
        values = daily[current.isoformat()]
        trend.append({
            "date": current.isoformat(), "total": values["total"],
            "captured": values["captured"], "created": values["created"],
            "changed": values["changed"], "reviewed": values["reviewed"],
        })
    organization = organization_payload(session)
    return {
        "period": {"days": window_days, "start": start_date.isoformat(), "end": now.date().isoformat()},
        "summary": {
            "captured": actions["captured"],
            "created": actions["created"] + actions["promoted"],
            "changed": sum(actions[action] for action in ("updated", "published", "archived", "restored")),
            "published": actions["published"],
            "reviewed": actions["reviewed"],
            "active_days": sum(1 for values in daily.values() if values["total"]),
            "touched_entities": len(touched),
            "knowledge_total": organization["stats"]["entities"],
        },
        "trend": trend,
        "action_breakdown": dict(actions.most_common()),
        "entity_breakdown": dict(entity_types.most_common()),
        "top_entities": [{"title": title, "events": count} for title, count in titles.most_common(6)],
    }


def maintenance_task(
    task_id: str, priority: str, category: str, title: str, reason: str,
    entity_type: str = "", entity_id: int | None = None, entity_title: str = "",
    action: str = "open", route: str = "",
) -> dict:
    return {
        "id": task_id, "priority": priority, "category": category,
        "title": title, "reason": reason, "entity_type": entity_type,
        "entity_id": entity_id, "entity_title": entity_title,
        "action": action, "route": route or workspace_route(entity_type),
    }


def knowledge_maintenance_payload(session: Session, now: datetime) -> dict:
    organization = organization_payload(session)
    tasks: list[dict] = []
    entity_map = {(item["entity_type"], item["id"]): item for item in organization["entities"]}
    review_states = list(session.scalars(select(ReviewState)))
    review_map = {(state.entity_type, state.entity_id): state for state in review_states}

    for state in review_states:
        entity = entity_map.get((state.entity_type, state.entity_id))
        if not entity:
            continue
        due_at = aware_datetime(state.next_review_at)
        if state.status == "pending" or not due_at or due_at <= now:
            overdue_days = max(0, (now.date() - due_at.date()).days) if due_at else 0
            tasks.append(maintenance_task(
                f"review:{state.entity_type}:{state.entity_id}", "high" if overdue_days >= 7 else "medium",
                "review", f"回顾 {entity['title']}",
                f"已到回顾时间{f'，逾期 {overdue_days} 天' if overdue_days else ''}",
                state.entity_type, state.entity_id, entity["title"], "review", "review",
            ))

    inbox_rows = list(session.scalars(select(InboxItem).where(
        InboxItem.deleted_at.is_(None), InboxItem.status == "inbox",
    ).order_by(InboxItem.created_at.asc())))
    for item in inbox_rows:
        created_at = aware_datetime(item.created_at) or now
        age = max(0, (now.date() - created_at.date()).days)
        tasks.append(maintenance_task(
            f"inbox:{item.id}", "high" if age >= 7 else "medium" if age >= 3 else "low",
            "organize", f"整理 {item.title or item.body[:28] or '未命名记录'}",
            f"已在收件箱停留 {age} 天" if age else "今天新记录，建议补充归属",
            "inbox", item.id, item.title or item.body[:40], "organize", "inbox",
        ))

    orphan_keys = {(item["entity_type"], item["id"]) for item in organization["orphans"]}
    for item in organization["orphans"]:
        tasks.append(maintenance_task(
            f"orphan:{item['entity_type']}:{item['id']}", "medium", "relationship",
            f"连接孤立内容 {item['title']}", "当前没有专栏、节点或内容关系，检索上下文较弱",
            item["entity_type"], item["id"], item["title"], "relate",
        ))

    rows_by_type = {
        "knowledge_column": active_rows(session, KnowledgeColumn),
        "knowledge_node": active_rows(session, KnowledgeNode),
        "article": active_rows(session, Article),
        "document": active_rows(session, Document),
        "project": list(session.scalars(select(ContentEntry).where(
            ContentEntry.deleted_at.is_(None), ContentEntry.entity_type == "project",
        ))),
    }
    for entity_type, rows in rows_by_type.items():
        for row in rows:
            title = getattr(row, "title", None) or getattr(row, "name", None) or "未命名"
            summary = getattr(row, "summary", None) or getattr(row, "description", None) or ""
            content = getattr(row, "content_markdown", None) or getattr(row, "content_md", None) or getattr(row, "raw_text", None) or ""
            if not summary.strip():
                tasks.append(maintenance_task(
                    f"summary:{entity_type}:{row.id}", "medium", "content",
                    f"补充摘要 {title}", "缺少摘要会降低搜索结果辨识度和 AI 引用质量",
                    entity_type, row.id, title, "edit",
                ))
            if entity_type in {"knowledge_node", "article", "document", "project"} and len(content.strip()) < 80:
                tasks.append(maintenance_task(
                    f"content:{entity_type}:{row.id}", "high" if not content.strip() else "medium", "content",
                    f"完善正文 {title}", "正文内容不足，难以形成稳定的检索切片",
                    entity_type, row.id, title, "edit",
                ))
            updated_at = aware_datetime(getattr(row, "updated_at", None))
            if updated_at and (now.date() - updated_at.date()).days >= 45 and (entity_type, row.id) not in review_map:
                stale_days = (now.date() - updated_at.date()).days
                tasks.append(maintenance_task(
                    f"stale:{entity_type}:{row.id}", "low", "review",
                    f"检查旧内容 {title}", f"已有 {stale_days} 天未更新且未设置回顾计划",
                    entity_type, row.id, title, "review", "review",
                ))
            if entity_type == "document" and (row.parse_error or row.status not in {"ready", "disabled"}):
                tasks.append(maintenance_task(
                    f"document:{row.id}", "high", "system", f"检查文档 {title}",
                    row.parse_error or f"当前处理状态为 {row.status}",
                    entity_type, row.id, title, "repair", "documents",
                ))

    priority_order = {"high": 0, "medium": 1, "low": 2}
    category_order = {"system": 0, "organize": 1, "content": 2, "relationship": 3, "review": 4}
    tasks.sort(key=lambda item: (priority_order[item["priority"]], category_order.get(item["category"], 9), item["title"].casefold()))
    stats = Counter(task["priority"] for task in tasks)
    categories = Counter(task["category"] for task in tasks)
    return {
        "generated_at": now,
        "stats": {
            "total": len(tasks), "high": stats["high"], "medium": stats["medium"], "low": stats["low"],
            "orphans": len(orphan_keys), "inbox": len(inbox_rows),
        },
        "categories": dict(categories),
        "tasks": tasks[:100],
    }


def knowledge_opportunities_payload(session: Session) -> dict:
    all_nodes = active_rows(session, KnowledgeNode)
    nodes = sorted(
        all_nodes,
        key=lambda row: aware_datetime(row.updated_at) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )[:250]
    memberships: dict[int, set[int]] = defaultdict(set)
    for row in session.scalars(select(KnowledgeColumnNode)):
        memberships[row.node_id].add(row.column_id)
    existing_pairs = {
        frozenset((row.source_node_id, row.target_node_id))
        for row in session.scalars(select(KnowledgeRelation).where(KnowledgeRelation.is_active.is_(True)))
    }

    def normalized_title(node: KnowledgeNode) -> str:
        return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", node.title.casefold())

    def node_features(node: KnowledgeNode) -> dict:
        return {
            "title": node.title,
            "summary": f"{node.summary or ''} {(node.content_markdown or '')[:1200]}",
        }

    duplicates: list[dict] = []
    relations: list[dict] = []
    for index, source in enumerate(nodes):
        source_title = normalized_title(source)
        source_features = node_features(source)
        for target in nodes[index + 1:]:
            target_title = normalized_title(target)
            title_score = SequenceMatcher(None, source_title, target_title).ratio() if source_title and target_title else 0.0
            semantic_score = content_similarity(source_features, node_features(target))
            shared_columns = memberships[source.id] & memberships[target.id]
            pair = frozenset((source.id, target.id))

            duplicate_score = max(title_score, semantic_score)
            if source_title == target_title or (title_score >= 0.84 and semantic_score >= 0.18):
                duplicates.append({
                    "id": f"duplicate:{source.id}:{target.id}",
                    "source_id": source.id, "source_title": source.title,
                    "target_id": target.id, "target_title": target.title,
                    "score": round(duplicate_score, 2),
                    "reason": "标题规范化后相同" if source_title == target_title else "标题和正文高度相似",
                })
                continue

            relation_score = semantic_score + (0.18 if shared_columns else 0.0)
            if pair not in existing_pairs and relation_score >= 0.24:
                reasons = []
                if shared_columns:
                    reasons.append("属于同一知识专栏")
                if semantic_score >= 0.2:
                    reasons.append("正文语义与关键词相近")
                relation_type = "similar_to" if semantic_score >= 0.55 else "related_to"
                relations.append({
                    "id": f"relation:{source.id}:{target.id}",
                    "source_id": source.id, "source_title": source.title,
                    "target_id": target.id, "target_title": target.title,
                    "relation_type": relation_type,
                    "score": round(min(relation_score, 1.0), 2),
                    "reason": "；".join(reasons) or "内容主题相近",
                    "is_public": source.visibility == "public" and target.visibility == "public",
                })

    duplicates.sort(key=lambda item: (-item["score"], item["source_title"].casefold()))
    relations.sort(key=lambda item: (-item["score"], item["source_title"].casefold()))
    return {
        "scanned_nodes": len(nodes),
        "truncated": len(all_nodes) > len(nodes),
        "duplicates": duplicates[:20],
        "relations": relations[:30],
    }


def local_inbox_suggestion(session: Session, item: InboxItem) -> dict:
    content = " ".join(part.strip() for part in (item.title, item.body, item.source_url) if part and part.strip())
    lowered = content.casefold()
    project_words = ("项目", "系统", "平台", "开发", "部署", "pipeline", "runtime", "dashboard")
    reading_words = ("阅读", "读书", "论文", "书摘", "paper", "book", "arxiv")
    article_words = ("复盘", "实践", "教程", "总结", "思考", "随笔", "为什么", "如何")
    if any(word in lowered for word in project_words):
        entity_type = "project"
    elif item.item_type == "link" and any(word in lowered for word in reading_words):
        entity_type = "reading"
    elif len(item.body.strip()) >= 500 or any(word in lowered for word in article_words):
        entity_type = "post"
    else:
        entity_type = "knowledge"

    first_line = next((line.strip() for line in item.body.splitlines() if line.strip()), "")
    title = (item.title.strip() or first_line[:120] or item.source_url.strip() or "未命名内容")[:255]
    summary_source = re.sub(r"\s+", " ", item.body.strip())
    summary = summary_source[:240] or title
    tag_catalog = {
        "rag": "RAG", "agent": "Agent", "milvus": "Milvus", "redis": "Redis",
        "fastapi": "FastAPI", "embedding": "Embedding", "transformer": "Transformer",
        "langchain": "LangChain", "langgraph": "LangGraph", "docker": "Docker",
        "postgresql": "PostgreSQL", "python": "Python", "c#": "C#", ".net": ".NET",
        "向量": "向量检索", "知识图谱": "知识图谱", "混合检索": "混合检索",
        "大模型": "大模型", "记忆": "Memory",
    }
    tags = list(dict.fromkeys(label for needle, label in tag_catalog.items() if needle in lowered))[:8]

    columns = active_rows(session, KnowledgeColumn)
    nodes = active_rows(session, KnowledgeNode)
    ranked_columns = sorted(
        ((search_score(content, row.name, row.slug, row.description, row.description), row) for row in columns),
        key=lambda value: value[0], reverse=True,
    )
    ranked_nodes = sorted(
        ((search_score(content, row.title, row.slug, row.summary, row.content_markdown), row) for row in nodes),
        key=lambda value: value[0], reverse=True,
    )
    column_ids = [row.id for score, row in ranked_columns if score > 0][:3]
    node_ids = [row.id for score, row in ranked_nodes if score > 0][:5]
    reasons = [f"根据记录内容建议整理为{ {'knowledge': '知识节点', 'post': '文章', 'project': '项目', 'reading': '阅读记录'}[entity_type] }"]
    if tags:
        reasons.append(f"识别到主题：{'、'.join(tags)}")
    if column_ids or node_ids:
        reasons.append("已根据标题、摘要和正文匹配现有知识网络")
    return {
        "entity_type": entity_type, "title": title, "slug": slugify(title), "summary": summary,
        "visibility": "private", "node_type": "concept", "tag_names": tags,
        "column_ids": column_ids, "primary_column_id": column_ids[0] if column_ids else None,
        "node_ids": node_ids, "confidence": 0.62 if tags or column_ids or node_ids else 0.48,
        "reasons": reasons,
    }


def json_object_from_model(value: str | None) -> dict:
    if not value:
        return {}
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", value.strip(), flags=re.IGNORECASE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        payload = json.loads(cleaned[start:end + 1])
        return payload if isinstance(payload, dict) else {}
    except json.JSONDecodeError:
        return {}


def ai_workflow_payload(session: Session, limit: int = 20) -> dict:
    maximum = max(1, min(limit, 25))
    decisions = list(session.scalars(select(ActivityEvent).where(
        ActivityEvent.action.in_(("ai_suggestion_adopted", "ai_suggestion_rejected")),
    ).order_by(ActivityEvent.id.desc()).limit(500)))
    decided_item_ids = {event.entity_id for event in decisions if event.entity_id is not None}
    pending = list(session.scalars(select(InboxItem).where(
        InboxItem.deleted_at.is_(None), InboxItem.status == "inbox",
        InboxItem.id.not_in(decided_item_ids) if decided_item_ids else InboxItem.id > 0,
    ).order_by(InboxItem.created_at.asc(), InboxItem.id.asc()).limit(maximum)))
    queue = [{"item": inbox_dict(item), "suggestion": local_inbox_suggestion(session, item)} for item in pending]
    adopted = len([event for event in decisions if event.action == "ai_suggestion_adopted"])
    rejected = len(decisions) - adopted
    confidences = [float(row["suggestion"].get("confidence") or 0) for row in queue]
    tagged = len([row for row in queue if row["suggestion"].get("tag_names")])
    connected = len([
        row for row in queue
        if row["suggestion"].get("column_ids") or row["suggestion"].get("node_ids")
    ])
    readiness_values = []
    for row in queue:
        suggestion = row["suggestion"]
        readiness_values.append(
            float(suggestion.get("confidence") or 0) * 0.6
            + (0.2 if suggestion.get("tag_names") else 0)
            + (0.2 if suggestion.get("column_ids") or suggestion.get("node_ids") else 0)
        )
    recent_decisions = []
    for event in decisions[:12]:
        try:
            detail = json.loads(event.detail_json or "{}")
        except json.JSONDecodeError:
            detail = {}
        recent_decisions.append({
            "id": event.id,
            "decision": "adopted" if event.action == "ai_suggestion_adopted" else "rejected",
            "item_id": event.entity_id,
            "title": event.entity_title,
            "suggested_type": detail.get("suggested_type", "knowledge"),
            "confidence": detail.get("confidence", 0),
            "note": detail.get("note", ""),
            "created_at": event.created_at,
        })
    return {
        "stats": {
            "pending": len(pending),
            "evaluated": len(decisions),
            "adopted": adopted,
            "rejected": rejected,
            "adoption_rate": round(adopted / len(decisions), 2) if decisions else 0,
            "avg_confidence": round(sum(confidences) / len(confidences), 2) if confidences else 0,
            "tag_coverage": round(tagged / len(queue), 2) if queue else 0,
            "relation_coverage": round(connected / len(queue), 2) if queue else 0,
            "avg_readiness": round(sum(readiness_values) / len(readiness_values), 2) if readiness_values else 0,
        },
        "queue": queue,
        "recent_decisions": recent_decisions,
    }
