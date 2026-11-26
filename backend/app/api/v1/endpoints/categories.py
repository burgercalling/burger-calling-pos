from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.category import Category
from app.models.product import Product
from app.models.user import User, UserRole
from app.schemas.menu import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.audit import get_client_ip, record_audit_log
from app.storage.upload_service import LocalStorageService, get_upload_service

router = APIRouter(prefix="/categories", tags=["Categories"])


def _category_snapshot(c: Category) -> dict:
    return {
        "name": c.name,
        "image_url": c.image_url,
        "display_order": c.display_order,
        "is_active": c.is_active,
        "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
    }


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> CategoryResponse:
    existing = db.scalar(select(Category.id).where(func.lower(Category.name) == payload.name.lower()))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Category '{payload.name}' already exists")

    category = Category(
        name=payload.name,
        image_url=payload.image_url,
        display_order=payload.display_order,
        is_active=True,
    )
    db.add(category)
    db.flush()

    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=None, action="CREATE",
        entity_type="category", entity_id=category.id, old_values=None,
        new_values=_category_snapshot(category), ip_address=get_client_ip(request),
    )
    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="CATEGORY_CREATED",
        description=f"Created category '{category.name}'",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CategoryResponse]:
    filters = [Category.deleted_at.is_(None)]
    if not include_inactive:
        filters.append(Category.is_active.is_(True))
    categories = db.scalars(
        select(Category).where(*filters).order_by(Category.display_order.asc(), Category.name.asc())
    ).all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> CategoryResponse:
    category = db.scalar(select(Category).where(Category.id == category_id, Category.deleted_at.is_(None)))
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if payload.name and payload.name.lower() != category.name.lower():
        dup = db.scalar(select(Category.id).where(func.lower(Category.name) == payload.name.lower(), Category.id != category_id))
        if dup is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Category '{payload.name}' already exists")

    old_values = _category_snapshot(category)
    old_image = category.image_url
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(category, field, value)

    if "image_url" in update_data and old_image and old_image != category.image_url:
        storage.delete_image(old_image)

    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=None, action="UPDATE",
        entity_type="category", entity_id=category.id, old_values=old_values,
        new_values=_category_snapshot(category), ip_address=get_client_ip(request),
    )
    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="CATEGORY_UPDATED",
        description=f"Updated category '{category.name}'",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", response_model=CategoryResponse)
def soft_delete_category(
    category_id: UUID,
    request: Request,
    reassign_to_category_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> CategoryResponse:
    category = db.scalar(select(Category).where(Category.id == category_id, Category.deleted_at.is_(None)))
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    active_product_count = db.scalar(
        select(func.count(Product.id)).where(
            Product.category_id == category_id, Product.deleted_at.is_(None), Product.is_active.is_(True)
        )
    ) or 0

    if active_product_count > 0:
        if reassign_to_category_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete category while {active_product_count} active product(s) reference it. Reassign them first.",
            )
        if reassign_to_category_id == category_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reassignment target category must be different")
        target_category = db.scalar(
            select(Category).where(Category.id == reassign_to_category_id, Category.deleted_at.is_(None), Category.is_active.is_(True))
        )
        if target_category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reassignment target category not found")
        db.execute(update(Product).where(Product.category_id == category_id, Product.deleted_at.is_(None)).values(category_id=reassign_to_category_id))

    old_values = _category_snapshot(category)
    category.is_active = False
    category.deleted_at = datetime.now(timezone.utc)

    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=None, action="SOFT_DELETE",
        entity_type="category", entity_id=category.id, old_values=old_values,
        new_values=_category_snapshot(category), ip_address=get_client_ip(request),
    )
    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="CATEGORY_DELETED",
        description=f"Soft-deleted category '{category.name}'",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(category)
    return CategoryResponse.model_validate(category)
