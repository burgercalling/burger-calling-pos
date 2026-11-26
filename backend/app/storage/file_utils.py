import re
import uuid
from pathlib import Path

from fastapi import HTTPException, status

from app.core.config import settings

UPLOAD_SUBFOLDERS = ("logos", "products", "categories", "receipts", "temp")


def get_upload_root() -> Path:
    return Path(settings.UPLOAD_ROOT).resolve()


def ensure_upload_directories() -> Path:
    root = get_upload_root()
    root.mkdir(parents=True, exist_ok=True)
    for sub in UPLOAD_SUBFOLDERS:
        (root / sub).mkdir(parents=True, exist_ok=True)
    return root


def sanitize_stem(filename: str) -> str:
    stem = Path(filename).stem.lower()
    cleaned = re.sub(r"[^a-z0-9_-]+", "_", stem).strip("_")
    return (cleaned[:40] or "image")


def generate_unique_filename(original_filename: str, extension: str) -> str:
    prefix = uuid.uuid4().hex[:8]
    stem = sanitize_stem(original_filename)
    ext = extension.lower().lstrip(".")
    return f"{prefix}_{stem}.{ext}"


def to_public_relative_path(folder: str, filename: str) -> str:
    return f"/uploads/{folder}/{filename}"


def resolve_safe_upload_path(relative_path: str) -> Path:
    if not relative_path or ".." in relative_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path",
        )
    normalized = relative_path.strip().lstrip("/")
    if normalized.startswith("uploads/"):
        normalized = normalized.removeprefix("uploads/")

    root = get_upload_root()
    candidate = (root / normalized).resolve()
    if not candidate.is_relative_to(root):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path traversal detected",
        )
    return candidate
