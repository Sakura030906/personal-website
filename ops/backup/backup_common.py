import hashlib
import os
from pathlib import Path


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def pg_environment() -> dict[str, str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = required("POSTGRES_PASSWORD")
    return env


def database_args() -> list[str]:
    return [
        "--host", os.getenv("POSTGRES_HOST", "postgres"),
        "--port", os.getenv("POSTGRES_PORT", "5432"),
        "--username", os.getenv("POSTGRES_USER", "portfolio"),
        "--dbname", os.getenv("POSTGRES_DB", "portfolio"),
    ]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def upload_archive_to_oss(path: Path) -> str | None:
    if os.getenv("BACKUP_OSS_ENABLED", "false").lower() not in {"1", "true", "yes"}:
        return None

    import alibabacloud_oss_v2 as oss

    region = required("OSS_REGION")
    bucket = required("OSS_BUCKET")
    prefix = os.getenv("OSS_OBJECT_PREFIX", "portfolio").strip("/")
    key = "/".join(part for part in [prefix, "backups", path.name] if part)
    config = oss.config.load_default()
    config.credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
    config.region = region
    if os.getenv("OSS_ENDPOINT"):
        config.endpoint = os.environ["OSS_ENDPOINT"]
    client = oss.Client(config)
    client.put_object_from_file(
        oss.PutObjectRequest(bucket=bucket, key=key, content_type="application/gzip"),
        str(path),
    )
    return key
