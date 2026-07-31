#!/usr/bin/env python3
"""Rehearse an Alembic upgrade on a SQLite copy before touching the real DB."""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
ALEMBIC = BACKEND / ".venv" / "bin" / "alembic"


def sqlite_backup(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source) as source_db, sqlite3.connect(target) as target_db:
        source_db.backup(target_db)


def revision(path: Path) -> str:
    with sqlite3.connect(path) as database:
        row = database.execute("SELECT version_num FROM alembic_version").fetchone()
        integrity = database.execute("PRAGMA integrity_check").fetchone()
    if not row or integrity != ("ok",):
        raise RuntimeError(f"Database validation failed for {path}")
    return str(row[0])


def upgrade(path: Path) -> None:
    if not ALEMBIC.is_file():
        raise RuntimeError(f"Missing backend virtualenv Alembic: {ALEMBIC}")
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{path.resolve()}"
    subprocess.run([str(ALEMBIC), "upgrade", "head"], cwd=BACKEND, env=env, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", nargs="?", type=Path, default=BACKEND / "portfolio.db")
    parser.add_argument("--apply", action="store_true", help="upgrade the real database after the copy succeeds")
    args = parser.parse_args()
    database = args.database.resolve()
    if not database.is_file():
        raise SystemExit(f"Database does not exist: {database}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = ROOT / "backups" / "migration-rehearsals" / stamp
    backup = run_dir / database.name
    rehearsal = run_dir / f"{database.stem}.rehearsal.db"
    sqlite_backup(database, backup)
    shutil.copy2(backup, rehearsal)

    before = revision(rehearsal)
    upgrade(rehearsal)
    after = revision(rehearsal)
    print(f"Rehearsal passed: {before} -> {after}")
    print(f"Immutable backup: {backup}")
    print(f"Migrated copy: {rehearsal}")

    if not args.apply:
        print("Real database was not changed. Re-run with --apply after reviewing this result.")
        return

    upgrade(database)
    applied = revision(database)
    if applied != after:
        raise RuntimeError(f"Applied revision {applied} does not match rehearsal revision {after}")
    print(f"Real database upgraded successfully: {database} -> {applied}")


if __name__ == "__main__":
    main()
