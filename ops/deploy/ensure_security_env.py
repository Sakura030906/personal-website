#!/usr/bin/env python3
"""Add required production security settings without printing secret values."""

from __future__ import annotations

import argparse
import secrets
from pathlib import Path


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def set_value(lines: list[str], key: str, value: str, *, replace: bool = True) -> list[str]:
    prefix = f"{key}="
    found = False
    result: list[str] = []
    for line in lines:
        if line.startswith(prefix):
            if found:
                continue
            result.append(prefix + value if replace else line)
            found = True
        else:
            result.append(line)
    if not found:
        result.append(prefix + value)
    lines[:] = result
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("env_file", nargs="?", type=Path, default=Path(".env.production"))
    parser.add_argument("--rotate-jwt", action="store_true", help="invalidate existing login sessions with a new JWT secret")
    parser.add_argument(
        "--replace-minio-placeholder",
        action="store_true",
        help="replace only a placeholder MinIO secret; coordinate this value with the deployed stack",
    )
    args = parser.parse_args()
    if not args.env_file.is_file():
        raise SystemExit(f"Missing {args.env_file}")
    lines = read_lines(args.env_file)
    set_value(lines, "ENVIRONMENT", "production")
    set_value(lines, "AUTH_COOKIE_SECURE", "true")
    set_value(lines, "METRICS_TOKEN", secrets.token_urlsafe(32))
    if args.rotate_jwt:
        set_value(lines, "JWT_SECRET", secrets.token_urlsafe(48))
    if args.replace_minio_placeholder:
        access_prefix = "MILVUS_MINIO_ACCESS_KEY="
        access_values = [line.removeprefix(access_prefix) for line in lines if line.startswith(access_prefix)]
        if access_values:
            set_value(lines, "MILVUS_MINIO_ACCESS_KEY", access_values[-1])
        prefix = "MILVUS_MINIO_SECRET_KEY="
        values = [line.removeprefix(prefix) for line in lines if line.startswith(prefix)]
        current = values[-1] if values else ""
        if not current or any(marker in current.lower() for marker in ("replace", "change-me", "placeholder")):
            current = secrets.token_urlsafe(36)
        set_value(lines, "MILVUS_MINIO_SECRET_KEY", current)
    args.env_file.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print("Production security environment updated; secret values were not printed.")


if __name__ == "__main__":
    main()
