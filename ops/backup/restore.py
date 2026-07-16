import argparse
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

from backup_common import database_args, pg_environment, sha256


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore a portfolio PostgreSQL and upload backup")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--confirm", action="store_true", help="required because restore replaces database content")
    parser.add_argument("--skip-uploads", action="store_true")
    args = parser.parse_args()
    if not args.confirm:
        raise SystemExit("Refusing to restore without --confirm")
    if not args.archive.is_file():
        raise SystemExit(f"Backup not found: {args.archive}")

    upload_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    with tempfile.TemporaryDirectory() as temporary:
        work = Path(temporary)
        with tarfile.open(args.archive, "r:gz") as bundle:
            bundle.extractall(work, filter="data")
        manifest = json.loads((work / "manifest.json").read_text(encoding="utf-8"))
        dump = work / "database.dump"
        if sha256(dump) != manifest["database_sha256"]:
            raise SystemExit("Database checksum mismatch")
        subprocess.run(
            ["pg_restore", *database_args(), "--clean", "--if-exists", "--no-owner", "--no-privileges", str(dump)],
            check=True,
            env=pg_environment(),
        )
        if not args.skip_uploads and (work / "uploads").exists():
            upload_dir.mkdir(parents=True, exist_ok=True)
            shutil.copytree(work / "uploads", upload_dir, dirs_exist_ok=True)
    print("Restore completed")


if __name__ == "__main__":
    main()
