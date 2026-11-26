from dataclasses import dataclass
from typing import Literal, Protocol

from fastapi import HTTPException, UploadFile, status

from app.storage.file_utils import (
    ensure_upload_directories,
    generate_unique_filename,
    resolve_safe_upload_path,
    to_public_relative_path,
)
from app.storage.image_validator import validate_image_upload

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
    async def replace_image(
        self, file: UploadFile, folder: UploadFolder, old_relative_path: str | None
    ) -> UploadedImageResult: ...
    def delete_image(self, relative_path: str | None) -> bool: ...


class LocalStorageService:
    """
    Local disk storage backend.
    Designed behind StorageServiceProtocol so it can be swapped for S3, GCS,
    Azure Blob, or Supabase Storage without touching business logic.
    """

    async def save_image(
        self,
        file: UploadFile,
        folder: UploadFolder,
    ) -> UploadedImageResult:
        if folder not in VALID_UPLOAD_FOLDERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid upload folder",
            )

        contents, ext = await validate_image_upload(file)
        root = ensure_upload_directories()
        filename = generate_unique_filename(file.filename or "image", ext)
        dest_path = root / folder / filename

        while dest_path.exists():
            filename = generate_unique_filename(file.filename or "image", ext)
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
            content_type=file.content_type or f"image/{ext}",
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
        except HTTPException:
            return False
        except OSError:
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
