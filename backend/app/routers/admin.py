import json
import re
import shutil
import difflib
import hashlib
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..agent_eval import evaluate_agent, load_agent_eval_cases
from ..database import get_session
from ..document_rag import rebuild_document_index
from ..embeddings import embedding_status
from ..knowledge_rag import knowledge_node_index_status, rebuild_knowledge_node_index
from ..llm import llm_status
from ..models import AgentRun, AgentStep, AiFeedback, AiMemory, Asset, ContentChunk, ContentDraft, ContentEntry, ContentOpsTaskState, ContentVersion, Document, DocumentChunk, SearchEvent
from ..rag_eval import compare_retrieval_tunings, evaluate_retrieval, load_eval_cases
from ..schemas import ArticleWrite, ContentAutosaveIn, ContentDraftOut, ContentEntryIn, ContentEntryOut, ContentEntryUpdate, SiteDocument
from ..search import delete_content_entry_index, index_content_entry, rebuild_vector_index, search_entries, tuning_from_payload, tuning_payload
from ..security import require_admin
from ..site_sync import read_site_document, sync_site_document
from ..storage import publish_file
from ..vector_store import vector_store_status
from .articles import create_article as create_normalized_article

router = APIRouter()


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
    return json.dumps({key: payload.get(key, "") for key in CONTENT_FIELDS}, ensure_ascii=False, sort_keys=True)


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
        .where(ContentVersion.entity_type == entry.entity_type, ContentVersion.entity_id == entry.id)
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
    session.add(
        version
    )
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


def slugify(value: str) -> str:
    slug = re.sub(r"[^\w\u4e00-\u9fa5-]+", "-", value.strip().lower())
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:120] or uuid4().hex[:10]


def infer_gap_entity_type(query: str) -> str:
    lowered = query.lower()
    knowledge_keywords = ["redis", "milvus", "rag", "agent", "fastapi", "embedding", "transformer", "langchain", "向量", "检索", "缓存", "知识库"]
    project_keywords = ["项目", "demo", "github", "部署", "架构", "系统", "runtime", "edurag"]
    if any(keyword in lowered for keyword in project_keywords):
        return "project"
    if any(keyword in lowered for keyword in knowledge_keywords):
        return "knowledge"
    return "post"


def content_covers_query(entry: ContentEntry, query: str) -> bool:
    normalized = query.strip().lower()
    if not normalized:
        return False
    text = " ".join(
        [
            entry.title or "",
            entry.summary or "",
            entry.category or "",
            entry.content_md or "",
            entry.metadata_json or "",
        ]
    ).lower()
    return normalized in text


def entry_label(entry: ContentEntry) -> str:
    labels = {"post": "文章", "knowledge": "知识", "project": "项目", "reading": "阅读"}
    return labels.get(entry.entity_type, entry.entity_type)


def related_content(session: Session, query: str, limit: int = 6) -> list[ContentEntry]:
    ranked = search_entries(session, query, limit=limit, published_only=False)
    return [item.entry for item in ranked]


def build_gap_draft(query: str, title: str, entity_type: str, session: Session) -> tuple[str, dict, str]:
    related = related_content(session, query, limit=8)
    related_posts = [entry.title for entry in related if entry.entity_type == "post"][:4]
    related_knowledge = [entry.title for entry in related if entry.entity_type == "knowledge"][:6]
    related_projects = [entry.title for entry in related if entry.entity_type == "project"][:4]
    related_reading = [entry.title for entry in related if entry.entity_type == "reading"][:4]
    related_lines = [
        f"- [{entry_label(entry)}] {entry.title}：{entry.summary or entry.category or entry.slug}"
        for entry in related[:6]
    ]
    tags = sorted({query, *[entry.category for entry in related if entry.category], *[entry.title for entry in related[:3]]})
    tags = [tag for tag in tags if tag][:8]

    outline = [
        "## 这篇内容要解决什么问题",
        f"- 搜索词：`{query}`。",
        "- 解释读者为什么会搜这个词，以及这个问题在 AI Agent / RAG / 工程实践中的位置。",
        "",
        "## 核心概念",
        "- 定义关键术语。",
        "- 说明它和已有知识体系的关系。",
        "- 写出一个最小可运行或可理解的例子。",
        "",
        "## 工程实践",
        "- 使用场景。",
        "- 技术选型。",
        "- 常见坑。",
        "- 如何在你的项目或学习路线中落地。",
        "",
        "## 关联内容",
        *(related_lines or ["- 暂无强相关内容，建议补充后再回到这里建立双向链接。"]),
        "",
        "## 下一步",
        "- 补充真实代码或截图。",
        "- 关联知识节点、文章和项目。",
        "- 发布后回到 Search Analytics 检查该搜索词是否还有无结果记录。",
    ]

    if entity_type == "post":
        metadata = {
            "date": datetime.now(timezone.utc).date().isoformat(),
            "tags": tags or [query],
            "seoTitle": title,
            "seoDescription": f"围绕「{query}」整理概念、工程实践、常见坑和相关资料。",
            "canonical": "",
            "cover": "",
            "relatedProjects": related_projects,
            "relatedKnowledge": related_knowledge,
            "relatedPosts": related_posts,
            "relatedReading": related_reading,
            "sourceGap": query,
        }
        summary = f"围绕搜索缺口「{query}」整理概念、工程实践、常见坑和相关资料。"
    elif entity_type == "knowledge":
        metadata = {
            "items": [query, *related_knowledge[:4]],
            "relatedProjects": related_projects,
            "relatedKnowledge": related_knowledge,
            "relatedReading": [],
            "relatedPosts": related_posts,
            "noteLinks": [entry.title for entry in related[:6]],
            "notes": [
                {
                    "name": query,
                    "description": f"来自站内无结果搜索「{query}」的知识节点，待补充定义、例子和实践场景。",
                    "example": "",
                    "links": [entry.title for entry in related[:4]],
                }
            ],
            "sourceGap": query,
        }
        summary = f"来自搜索缺口「{query}」的知识节点，后续补充定义、示例和关联内容。"
    elif entity_type == "project":
        metadata = {
            "stack": [],
            "github": "",
            "demo": "",
            "status": "规划中",
            "relatedKnowledge": related_knowledge,
            "relatedPosts": related_posts,
            "relatedReading": related_reading,
            "sourceGap": query,
        }
        summary = f"来自搜索缺口「{query}」的项目说明草稿，后续补充架构、API、部署和复盘。"
    else:
        metadata = {
            "author": "",
            "status": "想读",
            "progress": 0,
            "relatedKnowledge": related_knowledge,
            "relatedProjects": related_projects,
            "relatedPosts": related_posts,
            "sourceGap": query,
            "highlights": [],
        }
        summary = f"来自搜索缺口「{query}」的阅读记录草稿，后续补充摘录、笔记和关联知识。"

    content_md = "\n".join([f"# {title}", "", *outline])
    return summary, metadata, content_md


@router.post("/relation-suggestions")
def relation_suggestions(
    payload: dict,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    entity_type = str(payload.get("entity_type") or "")
    entry_id = payload.get("id")
    query = " ".join(
        [
            str(payload.get("title") or ""),
            str(payload.get("summary") or ""),
            str(payload.get("category") or ""),
            str(payload.get("content_md") or ""),
            str(payload.get("metadata_json") or ""),
        ]
    ).strip()
    if not query:
        return {"suggestions": [], "groups": {"post": [], "knowledge": [], "project": [], "reading": []}}

    ranked = search_entries(session, query, limit=24, published_only=False)
    suggestions = []
    for item in ranked:
        entry = item.entry
        if entry.entity_type == "site":
            continue
        if entry.entity_type == entity_type and entry.id == entry_id:
            continue
        suggestions.append(
            {
                "id": entry.id,
                "entity_type": entry.entity_type,
                "title": entry.title,
                "slug": entry.slug,
                "summary": entry.summary,
                "category": entry.category,
                "score": round(item.score, 3),
            }
        )

    groups = {
        "post": [item for item in suggestions if item["entity_type"] == "post"][:6],
        "knowledge": [item for item in suggestions if item["entity_type"] == "knowledge"][:8],
        "project": [item for item in suggestions if item["entity_type"] == "project"][:6],
        "reading": [item for item in suggestions if item["entity_type"] == "reading"][:6],
    }
    return {"suggestions": suggestions[:18], "groups": groups}


def parse_metadata(entry: ContentEntry) -> dict:
    try:
        value = json.loads(entry.metadata_json or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def relation_field_for(entity_type: str) -> str:
    return {
        "post": "relatedPosts",
        "knowledge": "relatedKnowledge",
        "project": "relatedProjects",
        "reading": "relatedReading",
    }.get(entity_type, "")


def find_entry_by_title(entries: list[ContentEntry], entity_type: str, title: str) -> ContentEntry | None:
    normalized = title.strip().lower()
    if not normalized:
        return None
    for entry in entries:
        if entry.entity_type == entity_type and entry.title.strip().lower() == normalized:
            return entry
    return None


def relation_health_issues(entries: list[ContentEntry]) -> list[dict[str, object]]:
    relation_fields = {
        "relatedPosts": "post",
        "relatedKnowledge": "knowledge",
        "relatedProjects": "project",
        "relatedReading": "reading",
    }
    issues = []
    for source in entries:
        if source.entity_type not in {"post", "knowledge", "project", "reading"}:
            continue
        source_metadata = parse_metadata(source)
        for field, target_type in relation_fields.items():
            for target_title in source_metadata.get(field, []) or []:
                target = find_entry_by_title(entries, target_type, str(target_title))
                if not target:
                    issues.append(
                        {
                            "kind": "missing_target",
                            "source_id": source.id,
                            "source_type": source.entity_type,
                            "source_title": source.title,
                            "target_type": target_type,
                            "target_title": target_title,
                            "missing_field": "",
                            "missing_value": "",
                            "message": f"{entry_label(source)}「{source.title}」关联了不存在的 {target_type}：{target_title}",
                        }
                    )
                    continue
                reverse_field = relation_field_for(source.entity_type)
                target_metadata = parse_metadata(target)
                reverse_values = [str(item).strip().lower() for item in target_metadata.get(reverse_field, []) or []]
                if source.title.strip().lower() not in reverse_values:
                    issues.append(
                        {
                            "kind": "missing_backlink",
                            "source_id": source.id,
                            "source_type": source.entity_type,
                            "source_title": source.title,
                            "target_id": target.id,
                            "target_type": target.entity_type,
                            "target_title": target.title,
                            "missing_field": reverse_field,
                            "missing_value": source.title,
                            "message": f"{entry_label(source)}「{source.title}」关联了「{target.title}」，但对方缺少反向关联。",
                        }
                    )
    return issues


@router.get("/relation-health")
def relation_health(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    entries = list(session.scalars(select(ContentEntry).where(ContentEntry.entity_type.in_(["post", "knowledge", "project", "reading"]))))
    issues = relation_health_issues(entries)
    return {
        "stats": {
            "entries": len(entries),
            "issues": len(issues),
            "missing_backlinks": len([issue for issue in issues if issue["kind"] == "missing_backlink"]),
            "missing_targets": len([issue for issue in issues if issue["kind"] == "missing_target"]),
        },
        "issues": issues[:100],
    }


@router.post("/relation-health/fix")
def fix_relation_health(
    payload: dict,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str | int]:
    target_id = payload.get("target_id")
    missing_field = str(payload.get("missing_field") or "")
    missing_value = str(payload.get("missing_value") or "").strip()
    if not target_id or missing_field not in {"relatedPosts", "relatedKnowledge", "relatedProjects", "relatedReading"} or not missing_value:
        raise HTTPException(status_code=400, detail="Invalid relation fix payload")

    target = session.get(ContentEntry, int(target_id))
    if not target:
        raise HTTPException(status_code=404, detail="Target entry not found")

    metadata = parse_metadata(target)
    values = [str(item).strip() for item in metadata.get(missing_field, []) or [] if str(item).strip()]
    if missing_value not in values:
        save_version(session, target, user)
        values.append(missing_value)
        metadata[missing_field] = values
        target.metadata_json = json.dumps(metadata, ensure_ascii=False)
        index_content_entry(session, target)
        session.commit()
    return {"status": "fixed", "target_id": target.id}


def relation_values(metadata: dict) -> list:
    return [
        *parse_json_list(json.dumps(metadata.get("relatedProjects", []), ensure_ascii=False)),
        *parse_json_list(json.dumps(metadata.get("relatedKnowledge", []), ensure_ascii=False)),
        *parse_json_list(json.dumps(metadata.get("relatedPosts", []), ensure_ascii=False)),
        *parse_json_list(json.dumps(metadata.get("relatedReading", []), ensure_ascii=False)),
    ]


def publish_blockers(entry: ContentEntry) -> list[dict[str, str]]:
    metadata = parse_metadata(entry)
    blockers = []
    content_text = re.sub(r"\s+", "", entry.content_md or "")
    if not entry.summary.strip():
        blockers.append({"type": "content", "message": "缺少摘要"})
    if entry.entity_type in {"post", "knowledge"} and len(content_text) < 120:
        blockers.append({"type": "content", "message": "正文内容偏短"})
    if entry.entity_type == "project" and not (entry.content_md.strip() or metadata.get("stack") or metadata.get("status")):
        blockers.append({"type": "content", "message": "项目说明不足"})
    if entry.entity_type == "reading" and not (entry.content_md.strip() or metadata.get("highlights") or metadata.get("author")):
        blockers.append({"type": "content", "message": "阅读记录缺少笔记、摘录或作者"})

    if entry.entity_type == "post":
        if not (metadata.get("seoDescription") or entry.summary.strip()):
            blockers.append({"type": "seo", "message": "缺少 SEO 描述"})
        if not (metadata.get("tags") or metadata.get("keywords")):
            blockers.append({"type": "seo", "message": "缺少标签"})

    if entry.entity_type in {"post", "knowledge", "project", "reading"} and not relation_values(metadata):
        blockers.append({"type": "relation", "message": "缺少与文章、知识或项目的关联"})
    return blockers


def publish_stage(entry: ContentEntry, blockers: list[dict[str, str]]) -> str:
    if entry.status == "published":
        return "published"
    if not entry.content_md.strip() and not entry.summary.strip():
        return "draft"
    if any(blocker["type"] == "content" for blocker in blockers):
        return "needs_content"
    if any(blocker["type"] == "seo" for blocker in blockers):
        return "needs_seo"
    if any(blocker["type"] == "relation" for blocker in blockers):
        return "needs_relations"
    return "ready"


@router.get("/publish-workflow")
def publish_workflow(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    entries = list(
        session.scalars(
            select(ContentEntry)
            .where(ContentEntry.entity_type.in_(["post", "knowledge", "project", "reading"]))
            .order_by(ContentEntry.updated_at.desc())
        )
    )
    columns = {
        "draft": [],
        "needs_content": [],
        "needs_seo": [],
        "needs_relations": [],
        "ready": [],
        "published": [],
    }
    for entry in entries:
        blockers = publish_blockers(entry)
        stage = publish_stage(entry, blockers)
        metadata = parse_metadata(entry)
        workflow_id = metadata.get("sourceArticleId") if entry.entity_type == "post" else entry.id
        columns[stage].append(
            {
                "id": workflow_id or entry.id,
                "entity_type": entry.entity_type,
                "title": entry.title,
                "slug": entry.slug,
                "status": entry.status,
                "summary": entry.summary,
                "category": entry.category,
                "stage": stage,
                "blockers": blockers,
                "updated_at": entry.updated_at.isoformat() if entry.updated_at else "",
                "published_at": entry.published_at.isoformat() if entry.published_at else "",
            }
        )
    return {
        "stats": {key: len(value) for key, value in columns.items()},
        "columns": columns,
    }


@router.get("/ai-runs")
def list_ai_runs(
    limit: int = 30,
    session_id: str | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 100))
    query = select(AiMemory).order_by(AiMemory.created_at.desc(), AiMemory.id.desc()).limit(limit)
    if session_id:
        query = (
            select(AiMemory)
            .where(AiMemory.session_id == session_id)
            .order_by(AiMemory.created_at.desc(), AiMemory.id.desc())
            .limit(limit)
        )
    runs = list(session.scalars(query))
    total_latency = sum((run.latency_ms or 0) for run in runs)
    avg_latency = round(total_latency / len(runs)) if runs else 0
    avg_quality = round(sum((run.quality_score or 0) for run in runs) / len(runs), 2) if runs else 0
    grounding_reports = [parse_json_object(getattr(run, "grounding_json", "{}")) for run in runs]

    return {
        "stats": {
            "total": len(runs),
            "avg_quality": avg_quality,
            "avg_latency_ms": avg_latency,
            "local_runs": len([run for run in runs if (run.generator or "local") == "local"]),
            "llm_runs": len([run for run in runs if (run.generator or "local") != "local"]),
            "guardrail_runs": len([run for run in runs if (run.generator or "") == "guardrail"]),
            "avg_support": round(
                sum(float(report.get("support_score", 0) or 0) for report in grounding_reports) / len(grounding_reports),
                2,
            ) if grounding_reports else 0,
        },
        "runs": [
            {
                "id": run.id,
                "session_id": run.session_id,
                "question": run.question,
                "answer": run.answer,
                "source_slugs": parse_json_list(run.source_slugs),
                "sources": parse_json_list(getattr(run, "sources_json", "[]")),
                "trace": parse_json_list(getattr(run, "trace_json", "[]")),
                "prompt_context": getattr(run, "prompt_context", "") or "",
                "query_plan": parse_json_object(getattr(run, "query_plan_json", "{}")),
                "grounding": parse_json_object(getattr(run, "grounding_json", "{}")),
                "quality_score": getattr(run, "quality_score", 0) or 0,
                "generator": getattr(run, "generator", "local") or "local",
                "latency_ms": getattr(run, "latency_ms", 0) or 0,
                "created_at": run.created_at.isoformat() if run.created_at else "",
            }
            for run in runs
        ],
    }


@router.get("/agent-runs")
def list_agent_runs(
    limit: int = 30,
    session_id: str | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 100))
    query = select(AgentRun).order_by(AgentRun.created_at.desc(), AgentRun.id.desc()).limit(limit)
    if session_id:
        query = (
            select(AgentRun)
            .where(AgentRun.session_id == session_id)
            .order_by(AgentRun.created_at.desc(), AgentRun.id.desc())
            .limit(limit)
        )
    runs = list(session.scalars(query))
    payloads = []
    for run in runs:
        result = parse_json_object(run.result_json)
        steps = list(
            session.scalars(
                select(AgentStep)
                .where(AgentStep.run_id == run.id)
                .order_by(AgentStep.step_index.asc())
            )
        )
        payloads.append(
            {
                "id": run.id,
                "session_id": run.session_id,
                "goal": run.goal,
                "scope": run.scope,
                "status": run.status,
                "planner_mode": run.planner_mode,
                "planner": run.planner,
                "plan": parse_json_list(run.plan_json),
                "planner_trace": parse_json_list(run.planner_trace_json),
                "result": result,
                "error": run.error,
                "failure_category": run.failure_category,
                "max_steps": run.max_steps,
                "tool_calls": run.tool_calls,
                "resume_count": run.resume_count,
                "prompt_tokens": int(run.prompt_tokens or 0),
                "completion_tokens": int(run.completion_tokens or 0),
                "estimated_cost_usd": float(run.estimated_cost_usd or 0),
                "pending_confirmation": parse_json_object(run.pending_decision_json),
                "steps": [
                    {
                        "id": step.id,
                        "step_index": step.step_index,
                        "tool_name": step.tool_name,
                        "reason": step.reason,
                        "decision": parse_json_object(step.decision_json),
                        "status": step.status,
                        "input": parse_json_object(step.input_json),
                        "output": parse_json_object(step.output_json),
                        "error": step.error,
                        "duration_ms": step.duration_ms,
                    }
                    for step in steps
                ],
                "started_at": run.started_at.isoformat() if run.started_at else "",
                "completed_at": run.completed_at.isoformat() if run.completed_at else "",
                "created_at": run.created_at.isoformat() if run.created_at else "",
            }
        )

    completed = [item for item in payloads if item["status"] == "completed"]
    quality_values = [float(item["result"].get("quality_score") or 0) for item in completed]
    latency_values = [int(item["result"].get("latency_ms") or 0) for item in completed]
    failure_categories: dict[str, int] = {}
    for item in payloads:
        category = str(item.get("failure_category") or "")
        if category:
            failure_categories[category] = failure_categories.get(category, 0) + 1
    sorted_latencies = sorted(latency_values)
    p95_latency = sorted_latencies[min(len(sorted_latencies) - 1, int(len(sorted_latencies) * 0.95))] if sorted_latencies else 0
    return {
        "stats": {
            "total": len(payloads),
            "completed": len(completed),
            "failed": len([item for item in payloads if item["status"] == "failed"]),
            "cancelled": len([item for item in payloads if item["status"] == "cancelled"]),
            "success_rate": round(len(completed) / len(payloads), 2) if payloads else 0,
            "avg_quality": round(sum(quality_values) / len(quality_values), 2) if quality_values else 0,
            "avg_latency_ms": round(sum(latency_values) / len(latency_values)) if latency_values else 0,
            "p95_latency_ms": p95_latency,
            "tool_calls": sum(int(item["tool_calls"]) for item in payloads),
            "prompt_tokens": sum(int(item["prompt_tokens"]) for item in payloads),
            "completion_tokens": sum(int(item["completion_tokens"]) for item in payloads),
            "estimated_cost_usd": round(sum(float(item["estimated_cost_usd"]) for item in payloads), 8),
            "failure_categories": failure_categories,
        },
        "runs": payloads,
    }


@router.post("/agent/evaluate")
def evaluate_agent_suite(
    payload: dict | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    payload = payload or {}
    cases, source = load_agent_eval_cases(payload.get("cases"))
    planner_mode = str(payload.get("planner_mode") or "local").lower()
    if planner_mode not in {"local", "auto", "openai", "llm"}:
        raise HTTPException(status_code=400, detail="Unsupported planner_mode")
    evaluation = evaluate_agent(session, cases, planner_mode=planner_mode)
    return {"source": source, **evaluation}


@router.get("/rag/status")
def rag_status(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    chunk_count = session.scalar(select(func.count(ContentChunk.id))) or 0
    indexed_entries = session.scalar(select(func.count(func.distinct(ContentChunk.entry_id)))) or 0
    source_entries = session.scalar(
        select(func.count(ContentEntry.id)).where(ContentEntry.entity_type.in_(["post", "knowledge", "project", "reading"]))
    ) or 0
    published_entries = session.scalar(
        select(func.count(ContentEntry.id)).where(
            ContentEntry.entity_type.in_(["post", "knowledge", "project", "reading"]),
            ContentEntry.status == "published",
        )
    ) or 0
    last_indexed = session.scalar(select(func.max(ContentChunk.updated_at)))
    embedding_profiles = [
        {
            "provider": provider or "unknown",
            "model": model or "unknown",
            "dimensions": dimensions or 0,
            "chunks": count,
        }
        for provider, model, dimensions, count in session.execute(
            select(
                ContentChunk.embedding_provider,
                ContentChunk.embedding_model,
                ContentChunk.embedding_dimensions,
                func.count(ContentChunk.id),
            ).group_by(ContentChunk.embedding_provider, ContentChunk.embedding_model, ContentChunk.embedding_dimensions)
        )
    ]
    recent_chunks = list(session.scalars(select(ContentChunk).order_by(ContentChunk.updated_at.desc()).limit(8)))
    recent_document_chunks = list(session.scalars(select(DocumentChunk).order_by(DocumentChunk.updated_at.desc()).limit(8)))
    recent_document_ids = {chunk.document_id for chunk in recent_document_chunks}
    recent_documents = {
        document.id: document
        for document in session.scalars(select(Document).where(Document.id.in_(recent_document_ids)))
    } if recent_document_ids else {}
    node_index = knowledge_node_index_status(session)
    document_chunks = session.scalar(select(func.count(DocumentChunk.id)).where(DocumentChunk.is_enabled.is_(True))) or 0
    indexed_documents = session.scalar(select(func.count(func.distinct(DocumentChunk.document_id))).where(DocumentChunk.is_enabled.is_(True))) or 0
    return {
        "stats": {
            "chunks": chunk_count,
            "indexed_entries": indexed_entries,
            "source_entries": source_entries,
            "published_entries": published_entries,
            "coverage": round(indexed_entries / source_entries, 2) if source_entries else 0,
            "last_indexed": last_indexed.isoformat() if last_indexed else "",
            "embedding": embedding_status(),
            "llm": llm_status(),
            "embedding_profiles": embedding_profiles,
            "vector_store": vector_store_status(),
            "indexed_nodes": node_index["indexed_nodes"],
            "node_chunks": node_index["node_chunks"],
            "node_last_indexed": node_index["last_indexed"],
            "indexed_documents": indexed_documents,
            "document_chunks": document_chunks,
            "reranker": {
                "provider": settings.rag_reranker,
                "top_k": settings.rag_rerank_top_k,
                "weight": settings.rag_rerank_weight,
            },
            "query_expansion": {
                "provider": settings.rag_query_expansion,
                "max_queries": settings.rag_multi_query_limit,
                "fusion_k": settings.rag_fusion_k,
                "fusion_weight": settings.rag_fusion_weight,
            },
            "grounding": {
                "context_max_chars": settings.rag_context_max_chars,
                "evidence_threshold": settings.rag_evidence_threshold,
                "claim_support_threshold": settings.rag_claim_support_threshold,
                "min_answer_support": settings.rag_min_answer_support,
            },
        },
        "recent_chunks": [
            {
                "id": chunk.id,
                "entry_id": chunk.entry_id,
                "entity_type": chunk.entity_type,
                "slug": chunk.slug,
                "title": chunk.title,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content[:220],
                "token_count": chunk.token_count,
                "embedding_provider": getattr(chunk, "embedding_provider", "local") or "local",
                "embedding_model": getattr(chunk, "embedding_model", "hash") or "hash",
                "embedding_dimensions": getattr(chunk, "embedding_dimensions", 0) or 0,
                "updated_at": chunk.updated_at.isoformat() if chunk.updated_at else "",
            }
            for chunk in recent_chunks
        ] + [
            {
                "id": chunk.id,
                "entry_id": chunk.node_id,
                "entity_type": "knowledge_node",
                "slug": chunk.slug,
                "title": chunk.title,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content[:220],
                "token_count": chunk.token_count,
                "embedding_provider": chunk.embedding_provider,
                "embedding_model": chunk.embedding_model,
                "embedding_dimensions": chunk.embedding_dimensions,
                "updated_at": chunk.updated_at.isoformat() if chunk.updated_at else "",
            }
            for chunk in node_index["recent_chunks"][:8]
        ] + [
            {
                "id": chunk.id,
                "entry_id": chunk.document_id,
                "entity_type": "document",
                "slug": recent_documents[chunk.document_id].slug if chunk.document_id in recent_documents else "",
                "title": recent_documents[chunk.document_id].title if chunk.document_id in recent_documents else "已删除文档",
                "chunk_index": chunk.chunk_index,
                "content": chunk.content[:220],
                "token_count": chunk.token_count,
                "embedding_provider": chunk.embedding_provider,
                "embedding_model": chunk.embedding_model,
                "embedding_dimensions": chunk.embedding_dimensions,
                "updated_at": chunk.updated_at.isoformat() if chunk.updated_at else "",
            }
            for chunk in recent_document_chunks
        ],
    }


@router.post("/rag/rebuild")
def rebuild_rag_index(
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    result = rebuild_vector_index(session)
    node_result = rebuild_knowledge_node_index(session)
    document_result = rebuild_document_index(session)
    return {"status": "rebuilt", **result, **node_result, **document_result}


@router.post("/rag/evaluate")
def evaluate_rag(
    payload: dict | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    payload = payload or {}
    raw_questions = payload.get("questions") if isinstance(payload, dict) else None
    limit = max(1, min(int(payload.get("limit", 5) or 5), 10))
    published_only = bool(payload.get("published_only", True))
    cases, eval_source = load_eval_cases(raw_questions)
    tuning = tuning_from_payload(payload.get("tuning") if isinstance(payload.get("tuning"), dict) else None)
    evaluation = evaluate_retrieval(session, cases, limit=limit, published_only=published_only, tuning=tuning)
    raw_compare = payload.get("compare_tunings") if isinstance(payload, dict) else None
    compare_payloads = raw_compare if isinstance(raw_compare, list) and raw_compare else [
        {"name": "balanced", "lexical_weight": 1.0, "vector_weight": 12.0, "entry_vector_weight": 10.0, "min_score": 0.15, "milvus_expand": 5, "reranker": "local", "rerank_top_k": 20, "rerank_weight": 4.0},
        {"name": "semantic", "lexical_weight": 0.6, "vector_weight": 18.0, "entry_vector_weight": 14.0, "min_score": 0.15, "milvus_expand": 8},
        {"name": "keyword", "lexical_weight": 1.4, "vector_weight": 8.0, "entry_vector_weight": 6.0, "min_score": 0.15, "milvus_expand": 5},
        {"name": "no-rerank", "lexical_weight": 1.0, "vector_weight": 12.0, "entry_vector_weight": 10.0, "min_score": 0.15, "milvus_expand": 5, "reranker": "off", "rerank_weight": 0},
        {"name": "single-query", "lexical_weight": 1.0, "vector_weight": 12.0, "entry_vector_weight": 10.0, "min_score": 0.15, "milvus_expand": 5, "query_expansion": "off", "multi_query_limit": 1},
    ]
    comparisons = compare_retrieval_tunings(
        session,
        cases,
        [tuning_from_payload(item if isinstance(item, dict) else {}) for item in compare_payloads[:10]],
        limit=limit,
        published_only=published_only,
    )

    return {
        "stats": evaluation["stats"],
        "embedding": embedding_status(),
        "vector_store": vector_store_status(),
        "source": eval_source,
        "tuning": tuning_payload(tuning),
        "comparisons": comparisons,
        "cases": evaluation["cases"],
    }


@router.get("/ai-feedback")
def ai_feedback(
    limit: int = 50,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 100))
    feedbacks = list(session.scalars(select(AiFeedback).order_by(AiFeedback.created_at.desc()).limit(limit)))
    low_quality_runs = list(
        session.scalars(
            select(AiMemory)
            .where(AiMemory.quality_score < 0.45)
            .order_by(AiMemory.created_at.desc(), AiMemory.id.desc())
            .limit(30)
        )
    )
    useful = [item for item in feedbacks if item.rating == "useful"]
    not_useful = [item for item in feedbacks if item.rating == "not_useful"]

    issue_map: dict[str, dict[str, object]] = {}
    for item in not_useful:
        question = (item.question or item.note or "未记录问题").strip()
        issue = issue_map.setdefault(
            question,
            {
                "question": question,
                "count": 0,
                "reason": item.reason,
                "last_seen": item.created_at.isoformat() if item.created_at else "",
                "source_slugs": parse_json_list(item.source_slugs),
                "feedback_id": item.id,
                "kind": "negative_feedback",
                "suggested_type": infer_gap_entity_type(question),
                "suggested_title": f"{question}：补充站内答案依据",
            },
        )
        issue["count"] = int(issue["count"]) + 1

    for run in low_quality_runs:
        question = (run.question or "").strip()
        if not question or question in issue_map:
            continue
        issue_map[question] = {
            "question": question,
            "count": 1,
            "reason": "低引用质量",
            "last_seen": run.created_at.isoformat() if run.created_at else "",
            "source_slugs": parse_json_list(run.source_slugs),
            "feedback_id": None,
            "kind": "low_quality",
            "suggested_type": infer_gap_entity_type(question),
            "suggested_title": f"{question}：补充站内答案依据",
        }

    issues = sorted(issue_map.values(), key=lambda item: (-int(item["count"]), str(item["last_seen"])))[:30]
    return {
        "stats": {
            "feedback": len(feedbacks),
            "useful": len(useful),
            "not_useful": len(not_useful),
            "helpful_rate": round(len(useful) / len(feedbacks), 2) if feedbacks else 0,
            "low_quality_runs": len(low_quality_runs),
            "issues": len(issues),
        },
        "issues": issues,
        "recent_feedback": [
            {
                "id": item.id,
                "memory_id": item.memory_id,
                "session_id": item.session_id,
                "rating": item.rating,
                "reason": item.reason,
                "note": item.note,
                "question": item.question,
                "source_slugs": parse_json_list(item.source_slugs),
                "created_at": item.created_at.isoformat() if item.created_at else "",
            }
            for item in feedbacks
        ],
    }


@router.post("/ai-feedback/draft", response_model=ContentEntryOut)
def create_ai_feedback_draft(
    payload: dict,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentEntry:
    question = str(payload.get("question") or "").strip()
    feedback_id = payload.get("feedback_id")
    if feedback_id and not question:
        feedback = session.get(AiFeedback, int(feedback_id))
        if feedback:
            question = feedback.question or feedback.note
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    entity_type = str(payload.get("entity_type") or infer_gap_entity_type(question))
    if entity_type not in {"post", "knowledge", "reading"}:
        entity_type = "post"
    title = str(payload.get("title") or f"{question}：补充站内答案依据").strip()
    base_slug = slugify(payload.get("slug") or title)
    slug = base_slug
    suffix = 2
    while session.scalar(select(ContentEntry).where(ContentEntry.entity_type == entity_type, ContentEntry.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    summary, metadata, content_md = build_gap_draft(question, title, entity_type, session)
    metadata["sourceFeedback"] = feedback_id
    metadata["sourceQuestion"] = question
    if entity_type == "post":
        return create_normalized_article(
            ArticleWrite(
                slug=slug,
                title=title,
                summary=summary,
                content_md=content_md,
                metadata_json=json.dumps(metadata, ensure_ascii=False),
                status="draft",
                category="AI 反馈",
            ),
            user=user,
            session=session,
        )
    entry = ContentEntry(
        entity_type=entity_type,
        slug=slug,
        title=title,
        summary=summary,
        content_md=content_md,
        metadata_json=json.dumps(metadata, ensure_ascii=False),
        status="draft",
        category="AI 反馈",
    )
    session.add(entry)
    session.flush()
    save_version(session, entry, user)
    index_content_entry(session, entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.get("/content-gaps")
def content_gaps(
    limit: int = 20,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 80))
    events = list(
        session.scalars(
            select(SearchEvent)
            .where(SearchEvent.event_type == "search", SearchEvent.result_count == 0)
            .order_by(SearchEvent.created_at.desc())
            .limit(200)
        )
    )
    entries = list(session.scalars(select(ContentEntry)))
    counts: dict[str, dict[str, object]] = {}
    for event in events:
        query = (event.query or "").strip()
        if not query:
            continue
        bucket = counts.setdefault(query, {"query": query, "count": 0, "sources": set(), "last_seen": ""})
        bucket["count"] = int(bucket["count"]) + 1
        bucket["sources"].add(event.source)
        if not bucket["last_seen"]:
            bucket["last_seen"] = event.created_at.isoformat() if event.created_at else ""

    gaps = []
    for item in counts.values():
        query = str(item["query"])
        covered = [entry for entry in entries if content_covers_query(entry, query)]
        if covered:
            continue
        entity_type = infer_gap_entity_type(query)
        count = int(item["count"])
        gaps.append(
            {
                "query": query,
                "count": count,
                "sources": sorted(item["sources"]),
                "last_seen": item["last_seen"],
                "suggested_type": entity_type,
                "priority": "high" if count >= 3 else "medium" if count == 2 else "low",
                "suggested_title": f"{query}：从概念到实践" if entity_type == "post" else query,
                "reason": "用户搜索没有结果，且当前 CMS 内容没有直接覆盖该关键词。",
            }
        )

    priority_order = {"high": 0, "medium": 1, "low": 2}
    gaps.sort(key=lambda gap: (priority_order[gap["priority"]], -gap["count"], gap["query"]))
    return {
        "stats": {
            "gaps": len(gaps),
            "high": len([gap for gap in gaps if gap["priority"] == "high"]),
            "medium": len([gap for gap in gaps if gap["priority"] == "medium"]),
            "low": len([gap for gap in gaps if gap["priority"] == "low"]),
        },
        "gaps": gaps[:limit],
    }


@router.post("/content-gaps/draft", response_model=ContentEntryOut)
def create_gap_draft(
    payload: dict,
    user: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ContentEntry:
    query = str(payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    entity_type = str(payload.get("entity_type") or infer_gap_entity_type(query))
    if entity_type not in {"post", "knowledge", "project", "reading"}:
        entity_type = "post"

    title = str(payload.get("title") or (f"{query}：从概念到实践" if entity_type == "post" else query)).strip()
    base_slug = slugify(payload.get("slug") or title)
    slug = base_slug
    suffix = 2
    while session.scalar(select(ContentEntry).where(ContentEntry.entity_type == entity_type, ContentEntry.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    summary, metadata, content_md = build_gap_draft(query, title, entity_type, session)
    if entity_type == "post":
        return create_normalized_article(
            ArticleWrite(
                slug=slug,
                title=title,
                summary=summary,
                content_md=content_md,
                metadata_json=json.dumps(metadata, ensure_ascii=False),
                status="draft",
                category="内容缺口",
            ),
            user=user,
            session=session,
        )
    entry = ContentEntry(
        entity_type=entity_type,
        slug=slug,
        title=title,
        summary=summary,
        content_md=content_md,
        metadata_json=json.dumps(metadata, ensure_ascii=False),
        status="draft",
        category="内容缺口",
    )
    session.add(entry)
    session.flush()
    save_version(session, entry, user)
    index_content_entry(session, entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.get("/content-ops")
def content_ops(
    include_hidden: bool = False,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    gaps_payload = content_gaps(limit=12, _="admin", session=session)
    feedback_payload = ai_feedback(limit=80, _="admin", session=session)
    relation_payload = relation_health(_="admin", session=session)
    workflow_payload = publish_workflow(_="admin", session=session)

    tasks: list[dict[str, object]] = []
    for gap in gaps_payload.get("gaps", [])[:8]:
        priority = "high" if gap.get("priority") == "high" else "medium"
        tasks.append(
            {
                "id": f"gap:{gap.get('query')}",
                "source": "Search Gap",
                "priority": priority,
                "title": gap.get("suggested_title") or gap.get("query"),
                "detail": gap.get("reason"),
                "meta": f"{gap.get('count')} 次无结果 · {', '.join(gap.get('sources', []))}",
                "action": {
                    "kind": "create_gap_draft",
                    "query": gap.get("query"),
                    "title": gap.get("suggested_title"),
                    "entity_type": gap.get("suggested_type"),
                },
            }
        )

    for issue in feedback_payload.get("issues", [])[:8]:
        tasks.append(
            {
                "id": f"feedback:{issue.get('question')}",
                "source": "AI Feedback",
                "priority": "high" if issue.get("kind") == "negative_feedback" else "medium",
                "title": issue.get("suggested_title") or issue.get("question"),
                "detail": issue.get("reason") or "AI Lab 回答需要补充站内依据。",
                "meta": f"{issue.get('count')} 次 · {issue.get('kind')}",
                "action": {
                    "kind": "create_feedback_draft",
                    "feedback_id": issue.get("feedback_id"),
                    "question": issue.get("question"),
                    "title": issue.get("suggested_title"),
                    "entity_type": issue.get("suggested_type") or "post",
                },
            }
        )

    for issue in relation_payload.get("issues", [])[:8]:
        fixable = issue.get("kind") == "missing_backlink"
        tasks.append(
            {
                "id": f"relation:{issue.get('source_id')}:{issue.get('target_id', issue.get('target_title'))}",
                "source": "Relation Health",
                "priority": "medium" if fixable else "high",
                "title": f"{issue.get('source_title')} → {issue.get('target_title')}",
                "detail": issue.get("message"),
                "meta": issue.get("kind"),
                "action": {
                    "kind": "fix_relation" if fixable else "review_relation",
                    "target_id": issue.get("target_id"),
                    "missing_field": issue.get("missing_field"),
                    "missing_value": issue.get("missing_value"),
                },
            }
        )

    workflow_columns = workflow_payload.get("columns", {})
    for stage, priority in [("ready", "medium"), ("needs_content", "high"), ("needs_seo", "medium"), ("needs_relations", "medium")]:
        for entry in (workflow_columns.get(stage, []) or [])[:6]:
            tasks.append(
                {
                    "id": f"workflow:{entry.get('id')}:{stage}",
                    "source": "Publish Workflow",
                    "priority": priority,
                    "title": entry.get("title"),
                    "detail": "; ".join([blocker.get("message", "") for blocker in entry.get("blockers", [])]) or "内容已准备进入下一步。",
                    "meta": f"{entry.get('entity_type')} · {stage}",
                    "action": {
                        "kind": "publish_entry" if stage == "ready" else "open_entry",
                        "entry_id": entry.get("id"),
                        "entity_type": entry.get("entity_type"),
                    },
                }
            )

    priority_order = {"high": 0, "medium": 1, "low": 2}
    tasks.sort(key=lambda task: (priority_order.get(str(task["priority"]), 3), str(task["source"]), str(task["title"])))
    states = {state.task_id: state for state in session.scalars(select(ContentOpsTaskState))}
    visible_tasks = []
    hidden_tasks = []
    for task in tasks:
        state = states.get(str(task["id"]))
        if state:
            task["state"] = {
                "status": state.status,
                "note": state.note,
                "updated_at": state.updated_at.isoformat() if state.updated_at else "",
            }
            hidden_tasks.append(task)
        else:
            visible_tasks.append(task)
    response_tasks = visible_tasks if not include_hidden else tasks
    return {
        "stats": {
            "tasks": len(visible_tasks),
            "hidden": len(hidden_tasks),
            "total": len(tasks),
            "high": len([task for task in visible_tasks if task["priority"] == "high"]),
            "medium": len([task for task in visible_tasks if task["priority"] == "medium"]),
            "search_gaps": gaps_payload.get("stats", {}).get("gaps", 0),
            "ai_issues": feedback_payload.get("stats", {}).get("issues", 0),
            "relation_issues": relation_payload.get("stats", {}).get("issues", 0),
            "ready_to_publish": workflow_payload.get("stats", {}).get("ready", 0),
        },
        "tasks": response_tasks[:40],
    }


@router.post("/content-ops/task-state")
def set_content_ops_task_state(
    payload: dict,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    task_id = str(payload.get("task_id") or "").strip()
    status = str(payload.get("status") or "ignored").strip()
    note = str(payload.get("note") or "").strip()
    if not task_id:
        raise HTTPException(status_code=400, detail="task_id is required")
    if status not in {"ignored", "done"}:
        raise HTTPException(status_code=400, detail="status must be ignored or done")

    existing = session.scalar(select(ContentOpsTaskState).where(ContentOpsTaskState.task_id == task_id))
    if existing:
        existing.status = status
        existing.note = note
    else:
        session.add(ContentOpsTaskState(task_id=task_id, status=status, note=note))
    session.commit()
    return {"status": status, "task_id": task_id}


@router.delete("/content-ops/task-state/{task_id:path}")
def clear_content_ops_task_state(
    task_id: str,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    existing = session.scalar(select(ContentOpsTaskState).where(ContentOpsTaskState.task_id == task_id))
    if existing:
        session.delete(existing)
        session.commit()
    return {"status": "active", "task_id": task_id}


@router.get("/search-analytics")
def search_analytics(
    limit: int = 80,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    limit = max(1, min(limit, 200))
    events = list(session.scalars(select(SearchEvent).order_by(SearchEvent.created_at.desc()).limit(limit)))
    search_events = [event for event in events if event.event_type == "search"]
    click_events = [event for event in events if event.event_type == "click"]
    no_result_events = [event for event in search_events if event.result_count == 0 and event.query]

    query_stats: dict[str, dict[str, object]] = {}
    for event in search_events:
        query = (event.query or "").strip()
        if not query:
            continue
        bucket = query_stats.setdefault(query, {"query": query, "count": 0, "no_result": 0, "sources": set()})
        bucket["count"] = int(bucket["count"]) + 1
        bucket["no_result"] = int(bucket["no_result"]) + (1 if event.result_count == 0 else 0)
        bucket["sources"].add(event.source)

    top_queries = sorted(query_stats.values(), key=lambda item: int(item["count"]), reverse=True)[:12]
    for item in top_queries:
        item["sources"] = sorted(item["sources"])

    no_result_queries: dict[str, int] = {}
    for event in no_result_events:
        no_result_queries[event.query] = no_result_queries.get(event.query, 0) + 1

    return {
        "stats": {
            "events": len(events),
            "searches": len(search_events),
            "clicks": len(click_events),
            "no_results": len(no_result_events),
            "click_rate": round(len(click_events) / len(search_events), 2) if search_events else 0,
        },
        "top_queries": top_queries,
        "no_result_queries": [
            {"query": query, "count": count}
            for query, count in sorted(no_result_queries.items(), key=lambda item: item[1], reverse=True)[:12]
        ],
        "recent_events": [
            {
                "id": event.id,
                "session_id": event.session_id,
                "source": event.source,
                "event_type": event.event_type,
                "query": event.query,
                "result_count": event.result_count,
                "selected_type": event.selected_type,
                "selected_title": event.selected_title,
                "selected_href": event.selected_href,
                "created_at": event.created_at.isoformat() if event.created_at else "",
            }
            for event in events
        ],
    }


@router.get("/entries", response_model=list[ContentEntryOut])
def list_entries(
    entity_type: str | None = None,
    status: str | None = None,
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[ContentEntry]:
    query = select(ContentEntry).order_by(ContentEntry.updated_at.desc())
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
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    entry = session.get(ContentEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    delete_content_entry_index(session, entry.id)
    delete_draft(session, entry.id)
    for version in session.scalars(select(ContentVersion).where(ContentVersion.entity_id == entry.id)):
        session.delete(version)
    session.delete(entry)
    session.commit()
    return {"status": "deleted"}


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
def upload_asset(
    file: UploadFile = File(...),
    _: str = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, str | int | None]:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    original_name = Path(file.filename or "upload.bin").name
    target = upload_dir / f"{uuid4().hex}-{original_name}"

    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    content_type = file.content_type or "application/octet-stream"
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
