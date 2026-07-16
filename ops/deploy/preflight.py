import argparse
import re
from pathlib import Path


REQUIRED = {
    "DOMAIN",
    "LETSENCRYPT_EMAIL",
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "MILVUS_MINIO_SECRET_KEY",
}
PLACEHOLDERS = {"change-me", "replace", "example.com", "your-email"}


def read_env(path: Path) -> dict[str, str]:
    values = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate production environment before deployment")
    parser.add_argument("env_file", nargs="?", type=Path, default=Path(".env.production"))
    args = parser.parse_args()
    if not args.env_file.is_file():
        raise SystemExit(f"Missing {args.env_file}; copy .env.production.example first")
    env = read_env(args.env_file)
    errors = []
    for key in sorted(REQUIRED):
        value = env.get(key, "")
        if not value:
            errors.append(f"{key} is empty")
        elif any(marker in value.lower() for marker in PLACEHOLDERS):
            errors.append(f"{key} still contains a placeholder")
    if len(env.get("JWT_SECRET", "")) < 32:
        errors.append("JWT_SECRET must contain at least 32 characters")
    if len(env.get("POSTGRES_PASSWORD", "")) < 16:
        errors.append("POSTGRES_PASSWORD must contain at least 16 characters")
    if len(env.get("ADMIN_PASSWORD", "")) < 12:
        errors.append("ADMIN_PASSWORD must contain at least 12 characters")
    if env.get("ADMIN_PASSWORD") == env.get("POSTGRES_PASSWORD"):
        errors.append("ADMIN_PASSWORD and POSTGRES_PASSWORD must be different")
    if not re.fullmatch(r"[a-z0-9.-]+", env.get("DOMAIN", "")):
        errors.append("DOMAIN is invalid")
    if env.get("STORAGE_BACKEND", "local") == "oss":
        for key in ["OSS_REGION", "OSS_ENDPOINT", "OSS_BUCKET", "OSS_ACCESS_KEY_ID", "OSS_ACCESS_KEY_SECRET"]:
            if not env.get(key):
                errors.append(f"{key} is required for OSS storage")
    if env.get("BACKUP_OSS_ENABLED", "false").lower() in {"1", "true", "yes"} and not env.get("OSS_BUCKET"):
        errors.append("OSS_BUCKET is required when BACKUP_OSS_ENABLED=true")
    if errors:
        print("Production preflight failed:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("Production environment preflight passed")


if __name__ == "__main__":
    main()
