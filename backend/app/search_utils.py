import json


def parse_embedding(raw: str) -> list[float]:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return [float(item) for item in value] if isinstance(value, list) else []
