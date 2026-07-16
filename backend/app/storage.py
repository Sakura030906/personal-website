from pathlib import Path

from .config import settings


def configured_storage() -> str:
    return settings.storage_backend.strip().lower() or "local"


def normalize_object_key(value: str) -> str:
    prefix = settings.oss_object_prefix.strip().strip("/")
    key = value.strip().lstrip("/")
    return f"{prefix}/{key}" if prefix else key


def oss_client():
    if not settings.oss_region or not settings.oss_bucket:
        raise RuntimeError("OSS_REGION and OSS_BUCKET are required when STORAGE_BACKEND=oss")
    try:
        import alibabacloud_oss_v2 as oss
    except ImportError as error:
        raise RuntimeError("alibabacloud-oss-v2 is not installed") from error

    config = oss.config.load_default()
    config.credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
    config.region = settings.oss_region
    if settings.oss_endpoint:
        config.endpoint = settings.oss_endpoint
    return oss, oss.Client(config)


def object_public_url(object_key: str) -> str:
    base = settings.oss_public_base_url.strip().rstrip("/")
    if not base:
        endpoint = settings.oss_endpoint.strip().replace("https://", "").replace("http://", "").rstrip("/")
        endpoint = endpoint or f"oss-{settings.oss_region}.aliyuncs.com"
        base = f"https://{settings.oss_bucket}.{endpoint}"
    return f"{base}/{object_key}"


def publish_file(path: Path, relative_key: str, content_type: str = "application/octet-stream") -> str:
    if configured_storage() != "oss":
        return f"/uploads/{relative_key.lstrip('/')}"

    oss, client = oss_client()
    object_key = normalize_object_key(f"uploads/{relative_key}")
    client.put_object_from_file(
        oss.PutObjectRequest(bucket=settings.oss_bucket, key=object_key, content_type=content_type),
        str(path),
    )
    return object_public_url(object_key)


def delete_published_file(relative_key: str) -> None:
    if configured_storage() != "oss":
        return
    oss, client = oss_client()
    client.delete_object(
        oss.DeleteObjectRequest(
            bucket=settings.oss_bucket,
            key=normalize_object_key(f"uploads/{relative_key}"),
        )
    )
