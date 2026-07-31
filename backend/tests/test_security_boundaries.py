from io import BytesIO

import pytest
from fastapi import HTTPException
from PIL import Image

from app.config import Settings
from app.routers.metrics import require_metrics_token
from app.upload_security import validate_document, validate_image


def png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color="green").save(buffer, format="PNG")
    return buffer.getvalue()


def test_production_rejects_default_security_values():
    config = Settings(environment="production")
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        config.validate_runtime_security()


def test_image_validation_decodes_real_content():
    suffix, content_type = validate_image(png_bytes(), "cover.png", "image/png")
    assert suffix == ".png"
    assert content_type == "image/png"
    with pytest.raises(HTTPException) as error:
        validate_image(b"not an image", "cover.png", "image/png")
    assert error.value.status_code == 415


def test_document_validation_checks_magic_signature():
    assert validate_document(b"%PDF-1.7\n", "notes.pdf", "application/pdf") == (".pdf", "application/pdf")
    with pytest.raises(HTTPException) as error:
        validate_document(b"plain text", "notes.pdf", "application/pdf")
    assert error.value.status_code == 415


def test_metrics_token_is_required_when_configured(monkeypatch):
    monkeypatch.setattr("app.routers.metrics.settings.metrics_token", "a" * 24)
    with pytest.raises(HTTPException) as error:
        require_metrics_token(None)
    assert error.value.status_code == 404
    require_metrics_token("a" * 24)


def test_metrics_are_closed_when_no_token_is_configured(monkeypatch):
    monkeypatch.setattr("app.routers.metrics.settings.metrics_token", "")
    with pytest.raises(HTTPException) as error:
        require_metrics_token(None)
    assert error.value.status_code == 404
