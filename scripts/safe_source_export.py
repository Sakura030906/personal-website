#!/usr/bin/env python3
"""Create a source-only archive after excluding runtime data and scanning secrets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tarfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {
    ".git", ".venv", ".idea", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "node_modules", "dist", "uploads", "backups", "graphify-out", "__pycache__",
    ".safe-export", "backup-state", "maintenance-state", "chunks",
}
EXCLUDED_NAMES = {
    ".coverage", ".env", ".env.production", "portfolio.db", ".DS_Store",
}
EXCLUDED_RELATIVE = {"app.bundle.js", "script.js", "styles.css", "admin/admin.js", "admin/admin.css"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".swp", ".swo", ".db", ".sqlite", ".sqlite3"}
SECRET_PATTERNS = {
    "private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "OpenAI key": re.compile(rb"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "Alibaba access key": re.compile(rb"\bLTAI[A-Za-z0-9]{12,}\b"),
}


def included(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return not (
        any(part in EXCLUDED_PARTS for part in relative.parts)
        or str(relative) in EXCLUDED_RELATIVE
        or path.name in EXCLUDED_NAMES
        or path.suffix.lower() in EXCLUDED_SUFFIXES
        or path.name.startswith(".env.") and path.name != ".env.production.example"
    )


def source_files() -> list[Path]:
    return sorted(path for path in ROOT.rglob("*") if path.is_file() and included(path))


def scan(files: list[Path]) -> list[str]:
    findings: list[str] = []
    for path in files:
        if path.stat().st_size > 8 * 1024 * 1024:
            continue
        data = path.read_bytes()
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(data):
                findings.append(f"{path.relative_to(ROOT)}: possible {label}")
    return findings


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    files = source_files()
    findings = scan(files)
    if findings:
        raise SystemExit("Unsafe source export blocked:\n- " + "\n- ".join(findings))
    if args.check_only:
        print(f"Source export check passed ({len(files)} files)")
        return

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = (args.output or ROOT / ".safe-export" / f"portfolio-source-{stamp}.tar.gz").resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = []
    with tarfile.open(output, "w:gz") as archive:
        for path in files:
            relative = path.relative_to(ROOT)
            archive.add(path, arcname=Path("portfolio-source") / relative, recursive=False)
            manifest.append({"path": str(relative), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        payload = json.dumps({"created_at": stamp, "files": manifest}, ensure_ascii=False, indent=2).encode()
        info = tarfile.TarInfo("portfolio-source/SOURCE_MANIFEST.json")
        info.size = len(payload)
        archive.addfile(info, fileobj=__import__("io").BytesIO(payload))
    print(f"Safe source archive created: {output}")


if __name__ == "__main__":
    main()
