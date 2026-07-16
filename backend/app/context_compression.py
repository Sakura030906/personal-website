import re
from dataclasses import dataclass

from .reranker import query_features


@dataclass
class CompressedContext:
    text: str
    original_chars: int
    compressed_chars: int
    selected_segments: int


def split_segments(value: str) -> list[str]:
    normalized = re.sub(r"\n{2,}", "\n", (value or "").strip())
    return [segment.strip() for segment in re.split(r"(?<=[。！？.!?])\s+|\n", normalized) if segment.strip()]


def segment_score(segment: str, query: str) -> float:
    lowered = segment.lower()
    normalized_query = " ".join((query or "").lower().split())
    terms = query_features(query)
    hits = sum(term in lowered for term in terms)
    coverage = hits / len(terms) if terms else 0
    exact_bonus = 0.5 if normalized_query and normalized_query in lowered else 0
    return coverage + exact_bonus


def compress_context(query: str, value: str, max_chars: int = 700) -> CompressedContext:
    original = (value or "").strip()
    if not original:
        return CompressedContext(text="", original_chars=0, compressed_chars=0, selected_segments=0)
    if len(original) <= max_chars:
        return CompressedContext(text=original, original_chars=len(original), compressed_chars=len(original), selected_segments=1)

    segments = split_segments(original)
    scored = sorted(
        [(segment_score(segment, query), index, segment) for index, segment in enumerate(segments)],
        key=lambda item: (item[0], -item[1]),
        reverse=True,
    )
    selected = []
    size = 0
    for score, index, segment in scored:
        if selected and score <= 0:
            continue
        remaining = max_chars - size
        if remaining <= 0:
            break
        clipped = segment[:remaining]
        selected.append((index, clipped))
        size += len(clipped) + 1
    if not selected:
        selected = [(0, original[:max_chars])]
    text = "\n".join(segment for _, segment in sorted(selected))[:max_chars]
    return CompressedContext(
        text=text,
        original_chars=len(original),
        compressed_chars=len(text),
        selected_segments=len(selected),
    )
