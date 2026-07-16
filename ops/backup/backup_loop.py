import os
import time
import traceback

from backup_once import run


interval = max(3600, int(os.getenv("BACKUP_INTERVAL_SECONDS", "86400")))
while True:
    try:
        run()
    except Exception:
        traceback.print_exc()
    time.sleep(interval)
