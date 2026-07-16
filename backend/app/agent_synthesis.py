import json
import re
from typing import Any

from .config import settings
from .grounding import EvidenceReport, evaluate_evidence, grounding_payload, verify_answer
from .llm import build_grounded_prompt, call_openai_compatible_with_usage


def source_url(entity_type: str, slug: str) -> str:
    if entity_type == "knowledge_node":
        return f"#node-{slug}"
    if entity_type == "knowledge":
        return f"#knowledge-{slug}"
    if entity_type == "project":
        return f"#project-{slug}"
    if entity_type == "post":
        return f"#post-{slug}"
    if entity_type == "reading":
        return "#reading"
    return "#"


def clean_text(value: Any, limit: int = 1800) -> str:
    return " ".join(str(value or "").split())[:limit]


def evidence_query(goal: str) -> str:
    instruction_terms = {"compare", "versus", "vs", "explain", "find", "show", "summarize", "about"}
    ascii_terms = [
        term
        for term in re.findall(r"[a-z0-9][a-z0-9_.+-]{1,}", goal.lower())
        if term not in instruction_terms
    ]
    if ascii_terms:
        return " ".join(dict.fromkeys(ascii_terms))
    cleaned = goal
    for phrase in [
        "请帮我", "帮我", "告诉我", "请", "比较", "对比", "查看", "查找", "分析",
        "解释", "介绍", "总结", "有哪些", "有什么", "是什么", "的用途", "的区别",
        "的差异", "之间", "相关内容", "关联关系",
    ]:
        cleaned = cleaned.replace(phrase, " ")
    return clean_text(cleaned, 300) or goal


def collect_observations(history: list[dict]) -> tuple[list[dict], list[str], list[dict]]:
    sources_by_slug: dict[str, dict] = {}
    source_order: list[str] = []
    memories: list[str] = []
    relations: list[dict] = []

    for step in history:
        tool = step.get("tool")
        output = step.get("output") if isinstance(step.get("output"), dict) else {}
        if output.get("truncated"):
            continue
        if tool in {"search_content", "list_recent_content"}:
            for item in output.get("results") or []:
                if not isinstance(item, dict):
                    continue
                slug = str(item.get("slug") or "")
                if not slug:
                    continue
                if slug not in sources_by_slug:
                    source_order.append(slug)
                sources_by_slug[slug] = {
                    "entity_type": item.get("entity_type", "content"),
                    "slug": slug,
                    "title": item.get("title") or slug,
                    "summary": clean_text(item.get("summary"), 500),
                    "category": item.get("category", ""),
                    "updated_at": item.get("updated_at", ""),
                    "score": float(item.get("score") or (1 if tool == "list_recent_content" else 0)),
                    "matched_chunk": clean_text(item.get("matched_chunk"), 900),
                    "context": clean_text(item.get("matched_chunk") or item.get("summary"), 900),
                    "url": source_url(str(item.get("entity_type") or ""), slug),
                }
        elif tool == "get_content":
            item = output.get("content")
            if not isinstance(item, dict):
                continue
            slug = str(item.get("slug") or "")
            if not slug:
                continue
            if slug not in sources_by_slug:
                source_order.append(slug)
            current = sources_by_slug.get(slug, {})
            current.update(
                {
                    "entity_type": item.get("entity_type", current.get("entity_type", "content")),
                    "slug": slug,
                    "title": item.get("title") or current.get("title") or slug,
                    "summary": clean_text(item.get("summary") or current.get("summary"), 500),
                    "category": item.get("category", current.get("category", "")),
                    "context": clean_text(item.get("content") or current.get("context"), 1800),
                    "matched_chunk": clean_text(current.get("matched_chunk") or item.get("content"), 900),
                }
            )
            current["url"] = source_url(str(current.get("entity_type") or ""), slug)
            sources_by_slug[slug] = current
        elif tool == "compare_content":
            for item in output.get("items") or []:
                if not isinstance(item, dict):
                    continue
                slug = str(item.get("slug") or "")
                if not slug:
                    continue
                if slug not in sources_by_slug:
                    source_order.append(slug)
                current = sources_by_slug.get(slug, {})
                current.update(
                    {
                        "entity_type": item.get("entity_type", current.get("entity_type", "content")),
                        "slug": slug,
                        "title": item.get("title") or current.get("title") or slug,
                        "summary": clean_text(item.get("summary") or current.get("summary"), 500),
                        "category": item.get("category", current.get("category", "")),
                        "context": clean_text(item.get("content") or current.get("context"), 1800),
                        "matched_chunk": clean_text(current.get("matched_chunk") or item.get("content"), 900),
                    }
                )
                current["url"] = source_url(str(current.get("entity_type") or ""), slug)
                sources_by_slug[slug] = current
        elif tool == "explore_knowledge_graph" and output.get("found"):
            relation = {
                "source": output.get("source") or {},
                "relations": output.get("relations") or {},
            }
            relations.append(relation)
            slug = str(relation["source"].get("slug") or "")
            if slug in sources_by_slug:
                relation_text = clean_text(json.dumps(relation["relations"], ensure_ascii=False), 700)
                current = sources_by_slug[slug]
                current["context"] = clean_text(f"{current.get('context', '')} 关联关系：{relation_text}", 2000)
        elif tool == "recall_memory":
            for item in output.get("memories") or []:
                if isinstance(item, dict):
                    memories.append(f"Q: {clean_text(item.get('question'), 400)}\nA: {clean_text(item.get('answer'), 1200)}")

    sources = [sources_by_slug[slug] for slug in source_order if slug in sources_by_slug][:5]
    return sources, memories[:5], relations


def build_agent_context(goal: str, sources: list[dict], relations: list[dict]) -> str:
    blocks = [f"Goal: {goal}", "", "Verified tool observations:"]
    for index, source in enumerate(sources, start=1):
        blocks.append(
            "\n".join(
                [
                    f"{index}. [{source.get('entity_type', 'content')}] {source.get('title', source.get('slug', ''))}",
                    f"Slug: {source.get('slug', '')}",
                    f"URL: {source.get('url', '#')}",
                    f"Summary: {source.get('summary', '')}",
                    f"Context: {source.get('context') or source.get('matched_chunk', '')}",
                ]
            )
        )
    if relations:
        blocks.extend(["", f"Graph observations: {json.dumps(relations, ensure_ascii=False)}"])
    return "\n".join(blocks)


def local_agent_answer(goal: str, sources: list[dict]) -> str:
    if not sources:
        return "当前已发布的站内内容不足以完成这个任务。请先补充相关的文章、知识节点或项目资料。"
    comparison = any(keyword in goal.lower() for keyword in ["比较", "区别", "差异", "对比", "compare", "versus", " vs "])
    selected = sources[:2] if comparison else sources[:3]
    lines = []
    for index, source in enumerate(selected, start=1):
        evidence = clean_text(
            source.get("summary") or source.get("context") or source.get("matched_chunk"),
            420,
        ).rstrip("。！？!?；;,.，")
        lines.append(f"**{source.get('title', source.get('slug', '来源'))}**：{evidence} [{index}]。")
    if comparison and len(selected) > 1:
        return "\n\n".join(["用途对比：", *lines])
    return "\n\n".join(lines)


def recent_content_answer(sources: list[dict]) -> str:
    if not sources:
        return "当前还没有已发布内容。"
    lines = ["最近更新的站内内容："]
    for index, source in enumerate(sources, start=1):
        updated_at = str(source.get("updated_at") or "")[:10]
        date_label = f"（{updated_at}）" if updated_at else ""
        summary = clean_text(source.get("summary"), 220).rstrip("。")
        lines.append(f"{index}. **{source.get('title', source.get('slug', '内容'))}**{date_label}：{summary} [{index}]。")
    return "\n\n".join(lines)


def synthesize_agent_answer(goal: str, history: list[dict], use_model: bool = True) -> dict[str, Any]:
    sources, memories, relations = collect_observations(history)
    recent_mode = any(step.get("tool") == "list_recent_content" for step in history)
    evidence = (
        EvidenceReport("grounded", 1.0, len(sources), "工具按内容更新时间返回已发布来源")
        if recent_mode and sources
        else evaluate_evidence(evidence_query(goal), sources, settings.rag_evidence_threshold)
    )
    prompt_context = build_agent_context(goal, sources, relations)
    generator = "guardrail"
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "estimated_cost_usd": 0.0}

    if recent_mode and sources:
        answer = recent_content_answer(sources)
        generator = "local-agent"
    elif evidence.status == "insufficient":
        answer = (
            "当前已发布的站内内容不足以可靠完成这个任务。"
            f"原因：{evidence.reason}。请先补充相关内容，或把目标描述得更具体。"
        )
    elif use_model:
        messages = build_grounded_prompt(goal, prompt_context, memories)
        llm_answer, model, usage = call_openai_compatible_with_usage(messages)
        answer = llm_answer or local_agent_answer(goal, sources)
        generator = model if llm_answer else "local-agent"
    else:
        answer = local_agent_answer(goal, sources)
        generator = "local-agent"

    verification = verify_answer(answer if evidence.status == "grounded" else "", sources, settings.rag_claim_support_threshold)
    if generator not in {"guardrail", "local-agent"} and verification.support_score < settings.rag_min_answer_support:
        answer = local_agent_answer(goal, sources)
        generator = "agent-grounding-fallback"
        verification = verify_answer(answer, sources, settings.rag_claim_support_threshold)

    grounding = grounding_payload(evidence, verification)
    quality_score = 0.0
    if evidence.status == "grounded":
        quality_score = round(
            evidence.confidence * 0.45
            + verification.support_score * 0.35
            + verification.citation_coverage * 0.2,
            2,
        )
    return {
        "answer": answer,
        "sources": sources,
        "generator": generator,
        "quality_score": quality_score,
        "grounding": grounding,
        "prompt_context": prompt_context,
        "memory_context_count": len(memories),
        "relation_observations": relations,
        "model_usage": usage,
    }
