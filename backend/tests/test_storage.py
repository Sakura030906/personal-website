from pathlib import Path

from app import storage


def test_local_storage_returns_api_upload_url(monkeypatch, tmp_path: Path):
    source = tmp_path / "asset.txt"
    source.write_text("content", encoding="utf-8")
    monkeypatch.setattr(storage.settings, "storage_backend", "local")

    assert storage.publish_file(source, "notes/asset.txt", "text/plain") == "/uploads/notes/asset.txt"


def test_oss_object_key_and_custom_public_url(monkeypatch):
    monkeypatch.setattr(storage.settings, "oss_object_prefix", "portfolio/")
    monkeypatch.setattr(storage.settings, "oss_public_base_url", "https://static.example.com/")

    key = storage.normalize_object_key("/uploads/image.png")

    assert key == "portfolio/uploads/image.png"
    assert storage.object_public_url(key) == "https://static.example.com/portfolio/uploads/image.png"
