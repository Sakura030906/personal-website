from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from .config import settings


IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
DOCUMENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"},
    ".md": {"text/markdown", "text/plain", "application/octet-stream"},
    ".markdown": {"text/markdown", "text/plain", "application/octet-stream"},
    ".txt": {"text/plain", "application/octet-stream"},
}


async def read_limited(file: UploadFile, limit: int) -> bytes:
    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > limit:
            raise HTTPException(status_code=413, detail=f"文件超过 {limit // (1024 * 1024)} MB 限制")
        chunks.append(chunk)
    if size == 0:
        raise HTTPException(status_code=422, detail="文件内容为空")
    return b"".join(chunks)


def validate_image(data: bytes, filename: str, declared_type: str | None) -> tuple[str, str]:
    suffix = Path(filename).suffix.lower()
    if suffix not in IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="仅支持 JPEG、PNG、GIF 和 WebP 图片")
    expected = IMAGE_TYPES[suffix]
    if declared_type and declared_type != expected:
        raise HTTPException(status_code=415, detail="图片扩展名与 MIME 类型不一致")
    try:
        with Image.open(BytesIO(data)) as image:
            if image.width * image.height > settings.image_max_pixels:
                raise HTTPException(status_code=413, detail="图片像素尺寸过大")
            actual = Image.MIME.get(image.format or "", "")
            image.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=415, detail="图片内容无法解码") from exc
    if actual != expected:
        raise HTTPException(status_code=415, detail="图片实际格式与扩展名不一致")
    return suffix, expected


def validate_document(data: bytes, filename: str, declared_type: str | None) -> tuple[str, str]:
    suffix = Path(filename).suffix.lower()
    allowed = DOCUMENT_TYPES.get(suffix)
    if not allowed:
        raise HTTPException(status_code=415, detail="仅支持 PDF、DOCX、Markdown 和 TXT 文件")
    if declared_type and declared_type not in allowed:
        raise HTTPException(status_code=415, detail="文档扩展名与 MIME 类型不一致")
    if suffix == ".pdf" and not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="PDF 文件签名无效")
    if suffix == ".docx":
        try:
            with ZipFile(BytesIO(data)) as archive:
                if "[Content_Types].xml" not in archive.namelist() or "word/document.xml" not in archive.namelist():
                    raise HTTPException(status_code=415, detail="DOCX 文件结构无效")
        except BadZipFile as exc:
            raise HTTPException(status_code=415, detail="DOCX 文件结构无效") from exc
    content_type = next(iter(allowed - {"application/octet-stream", "application/zip"}), declared_type or "application/octet-stream")
    return suffix, content_type
