import re
from dataclasses import dataclass


TECH_ALIASES = {
    "rag": ["retrieval augmented generation", "检索增强生成", "知识库问答"],
    "milvus": ["向量数据库", "vector database", "向量检索"],
    "redis": ["缓存", "cache", "内存数据库"],
    "agent": ["智能体", "ai agent", "agent workflow"],
    "memory": ["长期记忆", "agent memory", "上下文记忆"],
    "embedding": ["向量化", "嵌入模型", "text embedding"],
    "transformer": ["attention", "注意力机制", "大模型架构"],
    "fastapi": ["python api", "后端接口", "异步接口"],
    "llm": ["大模型", "large language model", "语言模型"],
    "mysql": ["关系型数据库", "relational database", "sql database"],
}

QUESTION_FILLERS = [
    "请问",
    "我想知道",
    "能不能告诉我",
    "可以介绍一下",
    "是什么",
    "为什么",
    "怎么做",
    "怎么设计",
    "怎么实现",
    "怎么使用",
    "如何",
    "有什么用",
    "负责什么",
    "请介绍",
]


@dataclass
class QueryPlan:
    original: str
    queries: list[str]
    concepts: list[str]
    aliases: list[str]
    provider: str = "local"


def normalize_query(value: str) -> str:
    return " ".join(re.sub(r"[，。！？?；;：:]", " ", value or "").split())


def unique_queries(values: list[str], limit: int) -> list[str]:
    result = []
    seen = set()
    for value in values:
        normalized = normalize_query(value)
        key = normalized.lower()
        if len(normalized) < 2 or key in seen:
            continue
        seen.add(key)
        result.append(normalized)
        if len(result) >= limit:
            break
    return result


def build_query_plan(question: str, max_queries: int = 4, provider: str = "local") -> QueryPlan:
    original = normalize_query(question)
    if provider.lower() in {"", "off", "none", "disabled"}:
        return QueryPlan(original=original, queries=[original] if original else [], concepts=[], aliases=[], provider="off")

    lowered = original.lower()
    concepts = []
    aliases = []
    for concept, values in TECH_ALIASES.items():
        terms = [concept, *values]
        if any(term.lower() in lowered for term in terms):
            concepts.append(concept)
            aliases.extend(values)

    condensed = original
    for filler in QUESTION_FILLERS:
        condensed = condensed.replace(filler, " ")
    condensed = normalize_query(condensed)

    candidates = [original, condensed]
    for concept in concepts:
        candidates.append(" ".join([concept, *TECH_ALIASES[concept], condensed]))
    if concepts:
        candidates.append(" ".join([*concepts, *aliases, condensed]))

    queries = unique_queries(candidates, max(1, max_queries))
    return QueryPlan(
        original=original,
        queries=queries or ([original] if original else []),
        concepts=concepts,
        aliases=list(dict.fromkeys(aliases)),
        provider="local",
    )


def query_plan_payload(plan: QueryPlan) -> dict[str, object]:
    return {
        "provider": plan.provider,
        "original": plan.original,
        "queries": plan.queries,
        "concepts": plan.concepts,
        "aliases": plan.aliases,
    }
