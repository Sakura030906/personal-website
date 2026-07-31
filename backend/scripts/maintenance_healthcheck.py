import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings


path = Path(settings.maintenance_state_file)
if not path.is_file():
    sys.exit(1)
try:
    payload = json.loads(path.read_text(encoding="utf-8"))
    completed = datetime.fromisoformat(payload["completed_at"])
except (KeyError, ValueError, json.JSONDecodeError):
    sys.exit(1)
if completed.tzinfo is None:
    completed = completed.replace(tzinfo=timezone.utc)
max_age = max(7200, int(os.getenv("MAINTENANCE_INTERVAL_SECONDS", "86400")) * 2)
if payload.get("status") != "ok" or (datetime.now(timezone.utc) - completed).total_seconds() > max_age:
    sys.exit(1)
