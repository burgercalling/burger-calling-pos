from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_MIME_BY_EXT: dict[str, set[str]] = {
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
    "webp": {"image/webp"},
}


def _has_valid_magic_bytes(data: bytes, ext: str) -> bool:
    if ext in {"jpg", "jpeg"}:
        return len(data) >= 3 and data[:3] == b"\xff\xd8\xff"
    if ext == "png":
        return len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n"
    if ext == "webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


async def validate_image_upload(file: UploadFile) -> tuple[bytes, str]:
    filename = file.filename or ""
    ext = Path(filename).suffix.lower().lstrip(".")
    allowed_exts = set(settings.ALLOWED_IMAGE_TYPES)

    if not ext or ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(allowed_exts))}",
        )

    allowed_mimes = ALLOWED_MIME_BY_EXT.get(ext, set())
    if file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="MIME type does not match allowed image formats (JPG, PNG, WebP)",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if len(contents) > settings.MAX_UPLOAD_SIZE:
        max_mb = settings.MAX_UPLOAD_SIZE / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum allowed size of {max_mb:.1f} MB",
        )

    if not _has_valid_magic_bytes(contents, ext):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content does not match a valid JPG, PNG, or WebP image",
        )

    return contents, ext
