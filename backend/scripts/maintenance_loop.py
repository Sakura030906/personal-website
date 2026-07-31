import argparse
import json
import os
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.database import SessionLocal
from app.maintenance import send_alert, write_state, run_maintenance_cycle


def run_once() -> dict:
    state_file = Path(settings.maintenance_state_file)
    with SessionLocal() as session:
        return run_maintenance_cycle(session, state_file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate proactive knowledge tasks on a schedule")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    interval = max(3600, int(os.getenv("MAINTENANCE_INTERVAL_SECONDS", "86400")))
    while True:
        try:
            print(json.dumps(run_once(), ensure_ascii=False))
        except Exception as error:
            traceback.print_exc()
            failed = {"status": "error", "completed_at": datetime.now(timezone.utc).isoformat(), "error": str(error)}
            write_state(Path(settings.maintenance_state_file), failed)
            try:
                send_alert("Portfolio maintenance cycle failed", failed)
            except Exception:
                traceback.print_exc()
        if args.once:
            break
        time.sleep(interval)


if __name__ == "__main__":
    main()
