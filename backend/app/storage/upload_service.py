import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.storage.file_utils import (
    ensure_upload_directories,
    generate_unique_filename,
    resolve_safe_upload_path,
    to_public_relative_path,
)
from app.storage.image_validator import validate_image_bytes, validate_image_upload

UploadFolder = Literal["logos", "products", "categories", "receipts", "temp"]
VALID_UPLOAD_FOLDERS: set[str] = {"logos", "products", "categories", "receipts", "temp"}


@dataclass(frozen=True)
class UploadedImageResult:
    relative_path: str
    filename: str
    folder: str
    bytes: int
    content_type: str


class StorageServiceProtocol(Protocol):
    async def save_image(self, file: UploadFile, folder: UploadFolder) -> UploadedImageResult: ...
    async def save_image_from_url(self, image_url: str, folder: UploadFolder) -> UploadedImageResult: ...
    async def replace_image(
        self, file: UploadFile, folder: UploadFolder, old_relative_path: str | None
    ) -> UploadedImageResult: ...
    def delete_image(self, relative_path: str | None) -> bool: ...


async def _validate_public_http_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image URL must start with http:// or https://",
        )
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid URL hostname")

    try:
        ip_str = await asyncio.to_thread(socket.gethostbyname, hostname)
        ip_obj = ipaddress.ip_address(ip_str)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Private or local network URLs are not permitted",
            )
    except HTTPException:
        raise
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve image URL host",
        )
    return raw_url.strip()


class LocalStorageService:
    def _write_bytes_to_folder(
        self, contents: bytes, original_name: str, ext: str, folder: UploadFolder, content_type: str
    ) -> UploadedImageResult:
        root = ensure_upload_directories()
        filename = generate_unique_filename(original_name, ext)
        dest_path = root / folder / filename
        while dest_path.exists():
            filename = generate_unique_filename(original_name, ext)
            dest_path = root / folder / filename
        try:
            dest_path.write_bytes(contents)
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store uploaded file: {exc}",
            ) from exc

        return UploadedImageResult(
            relative_path=to_public_relative_path(folder, filename),
            filename=filename,
            folder=folder,
            bytes=len(contents),
            content_type=content_type,
        )

    async def save_image(
        self,
        file: UploadFile,
        folder: UploadFolder,
    ) -> UploadedImageResult:
        if folder not in VALID_UPLOAD_FOLDERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload folder")

        contents, ext = await validate_image_upload(file)
        return self._write_bytes_to_folder(
            contents,
            file.filename or "image",
            ext,
            folder,
            file.content_type or f"image/{ext}",
        )

    async def save_image_from_url(
        self,
        image_url: str,
        folder: UploadFolder,
    ) -> UploadedImageResult:
        if folder not in VALID_UPLOAD_FOLDERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload folder")

        safe_url = await _validate_public_http_url(image_url)
        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                resp = await client.get(safe_url, headers={"User-Agent": "BurgerCallingPOS/1.1"})
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not download image from URL: {exc}",
            ) from exc

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image URL returned HTTP {resp.status_code}",
            )

        if len(resp.content) > settings.MAX_UPLOAD_SIZE:
            max_mb = settings.MAX_UPLOAD_SIZE / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Downloaded image exceeds {max_mb:.1f} MB limit",
            )

        url_path = Path(urlparse(safe_url).path)
        ext = url_path.suffix.lower().lstrip(".")
        content_type = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
        valid_ext = validate_image_bytes(resp.content, ext, content_type)
        return self._write_bytes_to_folder(
            resp.content,
            url_path.name or f"remote.{valid_ext}",
            valid_ext,
            folder,
            content_type or f"image/{valid_ext}",
        )

    def delete_image(self, relative_path: str | None) -> bool:
        if not relative_path:
            return False
        if not relative_path.startswith("/uploads/") and not relative_path.startswith("uploads/"):
            return False
        try:
            target = resolve_safe_upload_path(relative_path)
            if target.exists() and target.is_file():
                target.unlink()
                return True
        except (HTTPException, OSError):
            return False
        return False

    async def replace_image(
        self,
        file: UploadFile,
        folder: UploadFolder,
        old_relative_path: str | None,
    ) -> UploadedImageResult:
        saved = await self.save_image(file, folder)
        if old_relative_path and old_relative_path != saved.relative_path:
            self.delete_image(old_relative_path)
        return saved


_storage_service = LocalStorageService()


def get_upload_service() -> LocalStorageService:
    return _storage_service
