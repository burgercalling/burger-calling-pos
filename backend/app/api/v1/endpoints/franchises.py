from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.franchise import Franchise
from app.models.setting import PrinterWidthMode, Setting
from app.models.user import User, UserRole
from app.schemas.franchise import (
    FranchiseCreate,
    FranchiseResponse,
    FranchiseUpdate,
    PaginatedFranchisesResponse,
)
from app.services.audit import get_client_ip, record_audit_log

router = APIRouter(prefix="/franchises", tags=["Franchises"])


def _franchise_snapshot(f: Franchise) -> dict:
    return {
        "outlet_code": f.outlet_code,
        "name": f.name,
        "model_type": f.model_type.value,
        "city": f.city,
        "address": f.address,
        "phone": f.phone,
        "email": f.email,
        "is_active": f.is_active,
        "deleted_at": f.deleted_at.isoformat() if f.deleted_at else None,
    }


@router.post("", response_model=FranchiseResponse, status_code=status.HTTP_201_CREATED)
def create_franchise(
    payload: FranchiseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> FranchiseResponse:
    existing = db.scalar(select(Franchise.id).where(Franchise.outlet_code == payload.outlet_code))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Outlet code '{payload.outlet_code}' is already in use",
        )

    franchise = Franchise(
        outlet_code=payload.outlet_code,
        name=payload.name,
        model_type=payload.model_type,
        city=payload.city,
        address=payload.address,
        phone=payload.phone,
        email=payload.email,
        is_active=True,
    )
    db.add(franchise)
    db.flush()

    global_setting = db.scalar(select(Setting).where(Setting.franchise_id.is_(None)).limit(1))
    outlet_setting = Setting(
        franchise_id=franchise.id,
        brand_name=global_setting.brand_name if global_setting else "Burger Calling",
        logo_url=global_setting.logo_url if global_setting else None,
        receipt_footer=(
            global_setting.receipt_footer
            if global_setting
            else "100% Pure Veg | Thank you for visiting Burger Calling!"
        ),
        tax_enabled=global_setting.tax_enabled if global_setting else False,
        tax_label=global_setting.tax_label if global_setting else "GST",
        tax_rate=global_setting.tax_rate if global_setting else Decimal("0.00"),
        gstin=None,
        currency_code=global_setting.currency_code if global_setting else "INR",
        currency_symbol=global_setting.currency_symbol if global_setting else "₹",
        date_format=global_setting.date_format if global_setting else "DD/MM/YYYY",
        timezone=global_setting.timezone if global_setting else "Asia/Kolkata",
        printer_width_mode=(
            global_setting.printer_width_mode if global_setting else PrinterWidthMode.AUTO
        ),
        default_kot_enabled=global_setting.default_kot_enabled if global_setting else True,
    )
    db.add(outlet_setting)

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=franchise.id,
        action="CREATE",
        entity_type="franchise",
        entity_id=franchise.id,
        old_values=None,
        new_values=_franchise_snapshot(franchise),
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(franchise)

    return FranchiseResponse.model_validate(franchise)


@router.get("", response_model=PaginatedFranchisesResponse)
def list_franchises(
    search: str | None = Query(default=None, max_length=100),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> PaginatedFranchisesResponse:
    filters = []
    if not include_deleted:
        filters.append(Franchise.deleted_at.is_(None))
    if is_active is not None:
        filters.append(Franchise.is_active == is_active)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Franchise.name.ilike(term),
                Franchise.outlet_code.ilike(term),
                Franchise.city.ilike(term),
            )
        )

    total = db.scalar(select(func.count(Franchise.id)).where(*filters)) or 0
    items = db.scalars(
        select(Franchise)
        .where(*filters)
        .order_by(Franchise.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return PaginatedFranchisesResponse(
        items=[FranchiseResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{franchise_id}", response_model=FranchiseResponse)
def get_franchise(
    franchise_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> FranchiseResponse:
    franchise = db.scalar(select(Franchise).where(Franchise.id == franchise_id))
    if franchise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Franchise not found")
    return FranchiseResponse.model_validate(franchise)


@router.patch("/{franchise_id}", response_model=FranchiseResponse)
def update_franchise(
    franchise_id: UUID,
    payload: FranchiseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> FranchiseResponse:
    franchise = db.scalar(
        select(Franchise).where(Franchise.id == franchise_id, Franchise.deleted_at.is_(None))
    )
    if franchise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Franchise not found")

    old_values = _franchise_snapshot(franchise)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(franchise, field, value)

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=franchise.id,
        action="UPDATE",
        entity_type="franchise",
        entity_id=franchise.id,
        old_values=old_values,
        new_values=_franchise_snapshot(franchise),
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(franchise)

    return FranchiseResponse.model_validate(franchise)


@router.delete("/{franchise_id}", response_model=FranchiseResponse)
def soft_delete_franchise(
    franchise_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> FranchiseResponse:
    franchise = db.scalar(
        select(Franchise).where(Franchise.id == franchise_id, Franchise.deleted_at.is_(None))
    )
    if franchise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Franchise not found")

    old_values = _franchise_snapshot(franchise)
    franchise.is_active = False
    franchise.deleted_at = datetime.now(timezone.utc)

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=franchise.id,
        action="SOFT_DELETE",
        entity_type="franchise",
        entity_id=franchise.id,
        old_values=old_values,
        new_values=_franchise_snapshot(franchise),
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(franchise)

    return FranchiseResponse.model_validate(franchise)
