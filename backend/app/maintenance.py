import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from .routers.proactive import dashboard_payload, refresh_tasks


def write_state(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    temporary.replace(path)


def send_alert(message: str, detail: dict) -> bool:
    webhook = os.getenv("ALERT_WEBHOOK_URL", "").strip()
    if not webhook:
        return False
    body = json.dumps({"component": "maintenance", "message": message, "detail": detail}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(webhook, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        return 200 <= response.status < 300


def run_maintenance_cycle(session: Session, state_file: Path, now: datetime | None = None) -> dict:
    started_at = now or datetime.now(timezone.utc)
    generated = refresh_tasks(session, started_at)
    dashboard = dashboard_payload(session, started_at)
    payload = {
        "status": "ok",
        "started_at": started_at.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "generated_signals": generated,
        "stats": dashboard["stats"],
        "focus": [task["title"] for task in dashboard["focus"]],
    }
    write_state(state_file, payload)
    threshold = max(1, int(os.getenv("ALERT_HIGH_PRIORITY_TASKS", "10")))
    if dashboard["stats"]["high_priority"] >= threshold:
        try:
            send_alert("High-priority knowledge tasks require attention", payload)
        except Exception:
            pass
    return payload
