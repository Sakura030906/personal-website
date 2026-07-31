import json
import os
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from backup_common import database_args, pg_environment, sha256, upload_archive_to_oss
from verify_backup import verify


def remove_expired_backups(backup_dir: Path) -> None:
    keep = max(1, int(os.getenv("BACKUP_RETENTION_COUNT", "14")))
    archives = sorted(backup_dir.glob("portfolio-*.tar.gz"), key=lambda path: path.stat().st_mtime, reverse=True)
    for archive in archives[keep:]:
        archive.unlink(missing_ok=True)


def run() -> Path:
    backup_dir = Path(os.getenv("BACKUP_DIR", "/backups"))
    upload_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = backup_dir / f"portfolio-{timestamp}.tar.gz"

    with tempfile.TemporaryDirectory(dir=backup_dir) as temporary:
        work = Path(temporary)
        dump = work / "database.dump"
        subprocess.run(
            ["pg_dump", *database_args(), "--format=custom", "--file", str(dump)],
            check=True,
            env=pg_environment(),
        )
        manifest = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "database_sha256": sha256(dump),
            "uploads_included": upload_dir.exists(),
            "format": 1,
        }
        (work / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        with tarfile.open(archive, "w:gz") as bundle:
            bundle.add(dump, arcname="database.dump")
            bundle.add(work / "manifest.json", arcname="manifest.json")
            if upload_dir.exists():
                bundle.add(upload_dir, arcname="uploads")

    remove_expired_backups(backup_dir)
    verify(archive)
    if os.getenv("BACKUP_RESTORE_DRILL_ENABLED", "false").lower() in {"1", "true", "yes"}:
        from restore_drill import drill
        drill(archive)
    oss_key = upload_archive_to_oss(archive)
    (backup_dir / ".last-success").write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
    print(json.dumps({"archive": str(archive), "size_bytes": archive.stat().st_size, "oss_key": oss_key}))
    return archive


if __name__ == "__main__":
    run()
