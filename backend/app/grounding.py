import re
from dataclasses import dataclass

from .reranker import query_features, score_candidate


@dataclass
class EvidenceReport:
    status: str
    confidence: float
    strong_sources: int
    reason: str


@dataclass
class VerificationReport:
    support_score: float
    citation_coverage: float
    supported_claims: int
    cited_claims: int
    total_claims: int
    unsupported_claims: list[str]
    invalid_citations: list[int]


def evaluate_evidence(question: str, sources: list[dict], threshold: float = 0.18) -> EvidenceReport:
    if not sources:
        return EvidenceReport(status="insufficient", confidence=0.0, strong_sources=0, reason="没有召回到站内来源")

    relevance_scores = []
    strong_sources = 0
    for source in sources:
        relevance = score_candidate(
            question,
            str(source.get("title", "")),
            str(source.get("summary", "")),
            str(source.get("matched_chunk") or source.get("context") or ""),
        ).score
        relevance_scores.append(relevance)
        if relevance >= threshold or int(source.get("lexical_score") or 0) > 0:
            strong_sources += 1

    best = max(relevance_scores, default=0.0)
    confidence = min(1.0, best * 0.75 + min(strong_sources, 3) * 0.08)
    if strong_sources == 0 or confidence < threshold:
        return EvidenceReport(
            status="insufficient",
            confidence=round(confidence, 4),
            strong_sources=strong_sources,
            reason="召回结果与问题的词义覆盖不足",
        )
    return EvidenceReport(
        status="grounded",
        confidence=round(confidence, 4),
        strong_sources=strong_sources,
        reason="站内来源与问题存在明确匹配",
    )


def claim_support(claim: str, corpus: str) -> float:
    terms = query_features(claim)
    if not terms:
        return 1.0
    hits = sum(term in corpus for term in terms)
    return hits / len(terms)


def verify_answer(answer: str, sources: list[dict], threshold: float = 0.16) -> VerificationReport:
    corpus = " ".join(
        str(source.get(key, ""))
        for source in sources
        for key in ["title", "summary", "matched_chunk", "context"]
    ).lower()
    claims = [
        claim.strip()
        for claim in re.split(r"[。！？!?\n]+", answer or "")
        if len(claim.strip()) >= 8
    ]
    if not claims:
        return VerificationReport(
            support_score=0.0,
            citation_coverage=0.0,
            supported_claims=0,
            cited_claims=0,
            total_claims=0,
            unsupported_claims=[],
            invalid_citations=[],
        )
    unsupported = []
    supported = 0
    cited = 0
    invalid_citations = set()
    for claim in claims:
        references = [int(value) for value in re.findall(r"\[(\d+)\]", claim)]
        valid_references = [value for value in references if 1 <= value <= len(sources)]
        invalid_citations.update(value for value in references if value not in valid_references)
        if valid_references:
            cited += 1
        if claim_support(claim, corpus) >= threshold:
            supported += 1
        else:
            unsupported.append(claim[:160])
    return VerificationReport(
        support_score=round(supported / len(claims), 4),
        citation_coverage=round(cited / len(claims), 4),
        supported_claims=supported,
        cited_claims=cited,
        total_claims=len(claims),
        unsupported_claims=unsupported[:5],
        invalid_citations=sorted(invalid_citations),
    )


def grounding_payload(evidence: EvidenceReport, verification: VerificationReport) -> dict[str, object]:
    return {
        "status": evidence.status,
        "confidence": evidence.confidence,
        "strong_sources": evidence.strong_sources,
        "reason": evidence.reason,
        "support_score": verification.support_score,
        "citation_coverage": verification.citation_coverage,
        "supported_claims": verification.supported_claims,
        "cited_claims": verification.cited_claims,
        "total_claims": verification.total_claims,
        "unsupported_claims": verification.unsupported_claims,
        "invalid_citations": verification.invalid_citations,
    }
