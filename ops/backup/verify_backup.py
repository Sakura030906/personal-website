import argparse
import hashlib
import json
import tarfile
from pathlib import Path


def verify(archive: Path) -> dict[str, object]:
    if not archive.is_file():
        raise SystemExit(f"Backup not found: {archive}")
    with tarfile.open(archive, "r:gz") as bundle:
        names = set(bundle.getnames())
        missing = {"database.dump", "manifest.json"} - names
        if missing:
            raise SystemExit(f"Backup is incomplete; missing: {', '.join(sorted(missing))}")
        manifest_file = bundle.extractfile("manifest.json")
        dump_file = bundle.extractfile("database.dump")
        if manifest_file is None or dump_file is None:
            raise SystemExit("Backup is missing its manifest or database dump")
        manifest = json.loads(manifest_file.read().decode("utf-8"))
        checksum = hashlib.sha256(dump_file.read()).hexdigest()
        if checksum != manifest.get("database_sha256"):
            raise SystemExit("Database checksum mismatch")
    result = {"archive": str(archive), "valid": True, "database_sha256": checksum}
    print(json.dumps(result, ensure_ascii=False))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify a portfolio backup archive")
    parser.add_argument("archive", type=Path)
    verify(parser.parse_args().archive)


if __name__ == "__main__":
    main()
