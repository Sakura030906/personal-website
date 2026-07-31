import argparse
import json
import os
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from backup_common import pg_environment
from verify_backup import verify


def connection_args(database: str | None = None) -> list[str]:
    args = [
        "--host", os.getenv("POSTGRES_HOST", "postgres"),
        "--port", os.getenv("POSTGRES_PORT", "5432"),
        "--username", os.getenv("POSTGRES_USER", "portfolio"),
    ]
    if database:
        args.extend(["--dbname", database])
    return args


def drill(archive: Path) -> dict[str, object]:
    verify(archive)
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    database = f"portfolio_restore_drill_{suffix}"
    env = pg_environment()
    created = False
    try:
        subprocess.run(["createdb", *connection_args(), database], check=True, env=env, capture_output=True, text=True)
        created = True
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            with tarfile.open(archive, "r:gz") as bundle:
                dump_member = bundle.getmember("database.dump")
                bundle.extract(dump_member, work, filter="data")
            subprocess.run(
                ["pg_restore", *connection_args(database), "--no-owner", "--no-privileges", str(work / "database.dump")],
                check=True, env=env, capture_output=True, text=True,
            )
        query = "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
        result = subprocess.run(
            ["psql", *connection_args(database), "--tuples-only", "--no-align", "--command", query],
            check=True, env=env, capture_output=True, text=True,
        )
        table_count = int(result.stdout.strip())
        if table_count < 5:
            raise RuntimeError(f"restore drill produced only {table_count} public tables")
        payload = {"archive": str(archive), "valid": True, "table_count": table_count, "checked_at": datetime.now(timezone.utc).isoformat()}
        print(json.dumps(payload, ensure_ascii=False))
        return payload
    finally:
        if created:
            subprocess.run(["dropdb", *connection_args(), "--if-exists", database], env=env, capture_output=True, text=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore a backup into a disposable database and validate it")
    parser.add_argument("archive", type=Path)
    drill(parser.parse_args().archive)


if __name__ == "__main__":
    main()
