import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.site_sync import sync_site_document


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    site_file = root / "data" / "site.json"
    site_data = json.loads(site_file.read_text(encoding="utf-8"))

    session = SessionLocal()
    try:
        sync_site_document(session, site_data)
        session.commit()
    finally:
        session.close()

    print(f"Imported {site_file}")


if __name__ == "__main__":
    main()
