import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from math import sqrt

from .config import settings


@dataclass
class EmbeddingResult:
    vector: list[float]
    provider: str
    model: str
    dimensions: int
    fallback_reason: str = ""


def normalize_vector(vector: list[float]) -> list[float]:
    magnitude = sqrt(sum(item * item for item in vector)) or 1.0
    return [item / magnitude for item in vector]


def local_embedding(value: str, dimensions: int | None = None) -> list[float]:
    vector_dimensions = max(16, dimensions or settings.embedding_dimensions or 128)
    vector = [0.0] * vector_dimensions
    normalized = value.lower()
    for index, char in enumerate(normalized):
        bucket = (ord(char) + index * 17) % vector_dimensions
        vector[bucket] += 1.0
    return normalize_vector(vector)


def openai_embedding(value: str) -> list[float]:
    return openai_embeddings([value])[0]


def openai_embeddings(values: list[str]) -> list[list[float]]:
    if not values:
        return []
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    url = settings.openai_base_url.rstrip("/") + "/embeddings"
    payload = json.dumps(
        {
            "model": settings.embedding_model,
            "input": values,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "authorization": f"Bearer {settings.openai_api_key}",
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=settings.embedding_timeout_seconds) as response:
        data = json.loads(response.read().decode("utf-8"))
    rows = sorted(data["data"], key=lambda item: item.get("index", 0))
    return [normalize_vector([float(item) for item in row["embedding"]]) for row in rows]


def ollama_embeddings(values: list[str]) -> list[list[float]]:
    if not values:
        return []
    url = settings.ollama_base_url.rstrip("/") + "/api/embed"
    payload = json.dumps({
        "model": settings.ollama_embedding_model,
        "input": values,
    }).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=settings.embedding_timeout_seconds) as response:
        data = json.loads(response.read().decode("utf-8"))
    vectors = data.get("embeddings") or []
    if len(vectors) != len(values):
        raise ValueError("Ollama returned an unexpected number of embeddings")
    return [normalize_vector([float(item) for item in vector]) for vector in vectors]


def embed_text(value: str) -> EmbeddingResult:
    return embed_texts([value])[0]


def embed_texts(values: list[str]) -> list[EmbeddingResult]:
    if not values:
        return []
    provider = settings.embedding_provider.strip().lower()
    if provider == "ollama":
        try:
            vectors = ollama_embeddings(values)
            return [
                EmbeddingResult(
                    vector=vector,
                    provider="ollama",
                    model=settings.ollama_embedding_model,
                    dimensions=len(vector),
                )
                for vector in vectors
            ]
        except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError, ValueError) as error:
            return [
                EmbeddingResult(
                    vector=(vector := local_embedding(value)),
                    provider="local",
                    model="hash-fallback",
                    dimensions=len(vector),
                    fallback_reason=str(error),
                )
                for value in values
            ]
    if provider == "openai":
        try:
            vectors = openai_embeddings(values)
            return [
                EmbeddingResult(
                    vector=vector,
                    provider="openai",
                    model=settings.embedding_model,
                    dimensions=len(vector),
                )
                for vector in vectors
            ]
        except (RuntimeError, urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError, ValueError) as error:
            results = []
            for value in values:
                vector = local_embedding(value)
                results.append(
                    EmbeddingResult(
                        vector=vector,
                        provider="local",
                        model="hash-fallback",
                        dimensions=len(vector),
                        fallback_reason=str(error),
                    )
                )
            return results

    results = []
    for value in values:
        vector = local_embedding(value)
        results.append(
            EmbeddingResult(
                vector=vector,
                provider="local",
                model="hash",
                dimensions=len(vector),
            )
        )
    return results


def embedding(value: str) -> list[float]:
    return embed_text(value).vector


def embedding_status() -> dict[str, object]:
    configured_provider = settings.embedding_provider.strip().lower() or "local"
    if configured_provider == "ollama":
        return {
            "configured_provider": configured_provider,
            "active_provider": "ollama",
            "model": settings.ollama_embedding_model,
            "dimensions": settings.embedding_dimensions,
            "fallback_reason": "",
        }
    if configured_provider == "openai" and settings.openai_api_key:
        return {
            "configured_provider": configured_provider,
            "active_provider": "openai",
            "model": settings.embedding_model,
            "dimensions": settings.embedding_dimensions,
            "fallback_reason": "",
        }
    if configured_provider == "openai" and not settings.openai_api_key:
        return {
            "configured_provider": configured_provider,
            "active_provider": "local",
            "model": "hash-fallback",
            "dimensions": settings.embedding_dimensions,
            "fallback_reason": "OPENAI_API_KEY is not configured",
        }
    return {
        "configured_provider": configured_provider,
        "active_provider": "local",
        "model": "hash",
        "dimensions": settings.embedding_dimensions,
        "fallback_reason": "",
    }
