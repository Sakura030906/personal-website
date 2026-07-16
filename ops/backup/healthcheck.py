import os
import sys
import time
from pathlib import Path


marker = Path(os.getenv("BACKUP_DIR", "/backups")) / ".last-success"
max_age = max(7200, int(os.getenv("BACKUP_INTERVAL_SECONDS", "86400")) * 2)
if not marker.exists() or time.time() - marker.stat().st_mtime > max_age:
    sys.exit(1)
