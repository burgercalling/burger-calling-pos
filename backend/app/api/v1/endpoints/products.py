from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.category import Category
from app.models.product import Product, ProductItemType
from app.models.user import User, UserRole
from app.schemas.menu import (
    PaginatedProductsResponse,
    ProductAvailabilityUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from app.services.audit import get_client_ip, record_audit_log
from app.storage.upload_service import LocalStorageService, get_upload_service

router = APIRouter(prefix="/products", tags=["Products"])


def _product_snapshot(p: Product) -> dict:
    return {
        "category_id": str(p.category_id),
        "sku": p.sku,
        "name": p.name,
        "description": p.description,
        "price": str(p.price),
        "image_url": p.image_url,
        "item_type": p.item_type.value,
        "is_available": p.is_available,
        "is_active": p.is_active,
        "deleted_at": p.deleted_at.isoformat() if p.deleted_at else None,
    }


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> ProductResponse:
    category = db.scalar(select(Category).where(Category.id == payload.category_id, Category.deleted_at.is_(None)))
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if payload.sku:
        existing_sku = db.scalar(select(Product.id).where(Product.sku == payload.sku))
        if existing_sku is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"SKU '{payload.sku}' already exists")

    product = Product(
        category_id=payload.category_id,
        sku=payload.sku,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        image_url=payload.image_url,
        item_type=payload.item_type,
        is_available=payload.is_available,
        is_active=True,
    )
    db.add(product)
    db.flush()

    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=None, action="CREATE",
        entity_type="product", entity_id=product.id, old_values=None,
        new_values=_product_snapshot(product), ip_address=get_client_ip(request),
    )
    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="PRODUCT_CREATED",
        description=f"Created product '{product.name}' (₹{product.price})",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)


@router.get("", response_model=PaginatedProductsResponse)
def list_products(
    category_id: UUID | None = Query(default=None),
    item_type: ProductItemType | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    is_available: bool | None = Query(default=None),
    is_active: bool | None = Query(default=True),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PaginatedProductsResponse:
    filters = [Product.deleted_at.is_(None)]
    if is_active is not None:
        filters.append(Product.is_active == is_active)
    if category_id is not None:
        filters.append(Product.category_id == category_id)
    if item_type is not None:
        filters.append(Product.item_type == item_type)
    if is_available is not None:
        filters.append(Product.is_available == is_available)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Product.name.ilike(term), Product.sku.ilike(term), Product.description.ilike(term)))

    total = db.scalar(select(func.count(Product.id)).where(*filters)) or 0
    items = db.scalars(
        select(Product).options(joinedload(Product.category)).where(*filters)
        .order_by(Product.name.asc()).offset((page - 1) * page_size).limit(page_size)
    ).all()

    return PaginatedProductsResponse(
        items=[ProductResponse.model_validate(item) for item in items],
        total=total, page=page, page_size=page_size,
    )


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> ProductResponse:
    product = db.scalar(
        select(Product).options(joinedload(Product.category)).where(Product.id == product_id, Product.deleted_at.is_(None))
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if payload.category_id is not None:
        cat = db.scalar(select(Category.id).where(Category.id == payload.category_id, Category.deleted_at.is_(None)))
        if cat is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target category not found")

    if payload.sku and payload.sku != product.sku:
        dup_sku = db.scalar(select(Product.id).where(Product.sku == payload.sku, Product.id != product_id))
        if dup_sku is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"SKU '{payload.sku}' already exists")

    old_values = _product_snapshot(product)
    old_image = product.image_url
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(product, field, value)

    if "image_url" in update_data and old_image and old_image != product.image_url:
        storage.delete_image(old_image)

    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=None, action="UPDATE",
        entity_type="product", entity_id=product.id, old_values=old_values,
        new_values=_product_snapshot(product), ip_address=get_client_ip(request),
    )
    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="PRODUCT_UPDATED",
        description=f"Updated product '{product.name}'",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)


@router.patch("/{product_id}/availability", response_model=ProductResponse)
def toggle_product_availability(
    product_id: UUID,
    payload: ProductAvailabilityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.FRANCHISE_OWNER)),
) -> ProductResponse:
    product = db.scalar(
        select(Product).options(joinedload(Product.category)).where(Product.id == product_id, Product.deleted_at.is_(None))
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    old_values = _product_snapshot(product)
    product.is_available = payload.is_available

    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=current_user.franchise_id,
        action="AVAILABILITY_TOGGLE", entity_type="product", entity_id=product.id,
        old_values=old_values, new_values=_product_snapshot(product), ip_address=get_client_ip(request),
    )
    db.add(ActivityLog(
        franchise_id=current_user.franchise_id, user_id=current_user.id,
        event_type="PRODUCT_AVAILABILITY_TOGGLED",
        description=f"Marked '{product.name}' as {'Available' if product.is_available else 'Unavailable'}",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)


@router.delete("/{product_id}", response_model=ProductResponse)
def soft_delete_product(
    product_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> ProductResponse:
    product = db.scalar(
        select(Product).options(joinedload(Product.category)).where(Product.id == product_id, Product.deleted_at.is_(None))
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    old_values = _product_snapshot(product)
    product.is_active = False
    product.is_available = False
    product.deleted_at = datetime.now(timezone.utc)

    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=None, action="SOFT_DELETE",
        entity_type="product", entity_id=product.id, old_values=old_values,
        new_values=_product_snapshot(product), ip_address=get_client_ip(request),
    )
    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="PRODUCT_DELETED",
        description=f"Soft-deleted product '{product.name}'",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)
