import re
from dataclasses import dataclass


@dataclass
class RerankResult:
    score: float
    reasons: list[str]


def normalize(value: str) -> str:
    return " ".join((value or "").lower().split())


def query_features(query: str) -> list[str]:
    normalized = normalize(query)
    ascii_terms = re.findall(r"[a-z0-9][a-z0-9_.+-]{1,}", normalized)
    chinese_runs = re.findall(r"[\u4e00-\u9fff]+", normalized)
    chinese_terms = []
    for run in chinese_runs:
        if len(run) <= 4:
            chinese_terms.append(run)
        chinese_terms.extend(run[index : index + 2] for index in range(len(run) - 1))
    return list(dict.fromkeys(ascii_terms + chinese_terms))


def score_candidate(query: str, title: str, summary: str, chunk: str) -> RerankResult:
    normalized_query = normalize(query)
    title_text = normalize(title)
    summary_text = normalize(summary)
    chunk_text = normalize(chunk)
    terms = query_features(query)
    if not normalized_query or not terms:
        return RerankResult(score=0.0, reasons=[])

    title_hits = sum(term in title_text for term in terms)
    context_hits = sum(term in f"{summary_text} {chunk_text}" for term in terms)
    title_coverage = title_hits / len(terms)
    context_coverage = context_hits / len(terms)
    exact_title = normalized_query in title_text
    exact_context = normalized_query in f"{summary_text} {chunk_text}"

    score = min(
        1.0,
        title_coverage * 0.5
        + context_coverage * 0.3
        + (0.15 if exact_title else 0)
        + (0.05 if exact_context else 0),
    )
    reasons = []
    if exact_title:
        reasons.append("标题完整匹配")
    elif title_hits:
        reasons.append(f"标题命中 {title_hits}/{len(terms)}")
    if exact_context:
        reasons.append("正文完整匹配")
    elif context_hits:
        reasons.append(f"内容覆盖 {context_hits}/{len(terms)}")
    return RerankResult(score=round(score, 4), reasons=reasons)
