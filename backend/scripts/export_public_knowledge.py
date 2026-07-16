import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal, run_migrations
from app.routers.public import public_columns, public_knowledge_graph, public_nodes


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SITE_JSON = PROJECT_ROOT / "data" / "site.json"


def json_default(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def main() -> None:
    run_migrations()
    document = json.loads(SITE_JSON.read_text(encoding="utf-8"))
    with SessionLocal() as session:
        document["knowledgeColumns"] = public_columns(session=session)
        document["knowledgeNodes"] = public_nodes(limit=500, offset=0, session=session)["items"]
        document["knowledgeGraph"] = public_knowledge_graph(session=session)
    SITE_JSON.write_text(json.dumps(document, ensure_ascii=False, indent=2, default=json_default) + "\n", encoding="utf-8")
    print(
        f"Exported {len(document['knowledgeNodes'])} nodes and "
        f"{len(document['knowledgeGraph']['edges'])} relations to {SITE_JSON}"
    )


if __name__ == "__main__":
    main()
