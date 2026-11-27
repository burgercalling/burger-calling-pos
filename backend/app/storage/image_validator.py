from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_MIME_BY_EXT: dict[str, set[str]] = {
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
    "webp": {"image/webp"},
}

MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def has_valid_magic_bytes(data: bytes, ext: str) -> bool:
    if ext in {"jpg", "jpeg"}:
        return len(data) >= 3 and data[:3] == b"\xff\xd8\xff"
    if ext == "png":
        return len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n"
    if ext == "webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


def validate_image_bytes(contents: bytes, ext: str, content_type: str | None) -> str:
    allowed_exts = set(settings.ALLOWED_IMAGE_TYPES)
    clean_ext = ext.lower().lstrip(".")

    if (not clean_ext or clean_ext not in allowed_exts) and content_type:
        mapped = MIME_TO_EXT.get(content_type.split(";")[0].strip().lower())
        if mapped and mapped in allowed_exts:
            clean_ext = mapped

    if not clean_ext or clean_ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(allowed_exts))}",
        )

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image is empty",
        )

    if len(contents) > settings.MAX_UPLOAD_SIZE:
        max_mb = settings.MAX_UPLOAD_SIZE / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum allowed size of {max_mb:.1f} MB",
        )

    if not has_valid_magic_bytes(contents, clean_ext):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content is not a valid JPG, PNG, or WebP image",
        )

    return clean_ext


async def validate_image_upload(file: UploadFile) -> tuple[bytes, str]:
    filename = file.filename or ""
    ext = Path(filename).suffix.lower().lstrip(".")
    allowed_mimes = ALLOWED_MIME_BY_EXT.get(ext, set())
    if ext in ALLOWED_MIME_BY_EXT and file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="MIME type does not match allowed image formats (JPG, PNG, WebP)",
        )
    contents = await file.read()
    valid_ext = validate_image_bytes(contents, ext, file.content_type)
    return contents, valid_ext
