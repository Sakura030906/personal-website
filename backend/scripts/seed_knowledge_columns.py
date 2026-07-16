import json
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.article_service import slugify
from app.database import SessionLocal, run_migrations
from app.models import KnowledgeColumn


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SITE_JSON = PROJECT_ROOT / "data" / "site.json"


def main() -> None:
    run_migrations()
    site = json.loads(SITE_JSON.read_text(encoding="utf-8"))
    topics = site.get("knowledgeBase", [])
    created = 0
    with SessionLocal() as session:
        for sort_order, topic in enumerate(topics):
            name = str(topic.get("topic") or "").strip()
            if not name:
                continue
            slug = slugify(name)
            existing = session.scalar(select(KnowledgeColumn).where(KnowledgeColumn.slug == slug))
            if existing:
                continue
            session.add(
                KnowledgeColumn(
                    name=name,
                    slug=slug,
                    description=str(topic.get("summary") or "").strip(),
                    icon="book-open",
                    visibility="public",
                    allow_ai_search=True,
                    sort_order=sort_order,
                )
            )
            created += 1
        session.commit()
    print(f"Knowledge columns created: {created}")


if __name__ == "__main__":
    main()
