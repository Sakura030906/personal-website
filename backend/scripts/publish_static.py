import argparse
import mimetypes
import os
from pathlib import Path


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish the generated static site to Alibaba Cloud OSS")
    parser.add_argument("--dist", type=Path, default=Path(__file__).resolve().parents[2] / "dist")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.dist.is_dir():
        raise SystemExit(f"Build output not found: {args.dist}. Run npm run build first.")

    bucket = required("OSS_BUCKET")
    region = required("OSS_REGION")
    prefix = os.getenv("OSS_STATIC_PREFIX", "").strip("/")
    endpoint = os.getenv("OSS_ENDPOINT", "").strip()
    files = [
        path for path in args.dist.rglob("*")
        if path.is_file() and ".openai" not in path.parts and "server" not in path.parts
    ]
    if args.dry_run:
        for path in files:
            key = "/".join(part for part in [prefix, path.relative_to(args.dist).as_posix()] if part)
            print(f"DRY RUN {path} -> oss://{bucket}/{key}")
        print(f"{len(files)} files ready")
        return

    import alibabacloud_oss_v2 as oss

    config = oss.config.load_default()
    config.credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
    config.region = region
    if endpoint:
        config.endpoint = endpoint
    client = oss.Client(config)

    for path in files:
        relative = path.relative_to(args.dist).as_posix()
        key = "/".join(part for part in [prefix, relative] if part)
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        immutable = path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff", ".woff2"}
        cache_control = "public, max-age=31536000, immutable" if immutable else "public, max-age=0, must-revalidate"
        client.put_object_from_file(
            oss.PutObjectRequest(
                bucket=bucket,
                key=key,
                content_type=content_type,
                cache_control=cache_control,
            ),
            str(path),
        )
        print(f"Uploaded {key}")
    print(f"Published {len(files)} files to oss://{bucket}/{prefix}")


if __name__ == "__main__":
    main()
