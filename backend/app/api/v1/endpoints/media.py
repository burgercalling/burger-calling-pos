from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.api.deps import require_roles
from app.models.user import User, UserRole
from app.schemas.auth import MessageResponse
from app.schemas.menu import MediaUploadResponse, MediaUrlUploadRequest
from app.storage.upload_service import (
    LocalStorageService,
    UploadFolder,
    get_upload_service,
)

router = APIRouter(prefix="/media", tags=["Media Storage"])


def _to_response(res) -> MediaUploadResponse:
    return MediaUploadResponse(
        image_url=res.relative_path,
        relative_path=res.relative_path,
        filename=res.filename,
        folder=res.folder,
        bytes=res.bytes,
        content_type=res.content_type,
    )


@router.post("/products", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_product_image(
    file: UploadFile = File(...),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> MediaUploadResponse:
    return _to_response(await storage.save_image(file, "products"))


@router.post("/categories", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_category_image(
    file: UploadFile = File(...),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> MediaUploadResponse:
    return _to_response(await storage.save_image(file, "categories"))


@router.post("/logos", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_logo_image(
    file: UploadFile = File(...),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_OWNER)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> MediaUploadResponse:
    return _to_response(await storage.save_image(file, "logos"))


@router.post("/from-url", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image_from_url(
    payload: MediaUrlUploadRequest,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_OWNER)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> MediaUploadResponse:
    if payload.folder in ("products", "categories") and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can upload product or category images",
        )
    return _to_response(await storage.save_image_from_url(payload.image_url, payload.folder))


@router.put("/replace", response_model=MediaUploadResponse)
async def replace_existing_image(
    file: UploadFile = File(...),
    folder: UploadFolder = Form(...),
    old_path: str | None = Form(default=None),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_OWNER)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> MediaUploadResponse:
    return _to_response(await storage.replace_image(file, folder, old_path))


@router.delete("", response_model=MessageResponse)
def delete_uploaded_image(
    path: str = Query(..., min_length=5),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_OWNER)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> MessageResponse:
    deleted = storage.delete_image(path)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image file not found or already deleted",
        )
    return MessageResponse(message="Image deleted successfully")
