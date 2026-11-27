from datetime import date, datetime, time, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.franchise import Franchise
from app.models.inventory import (
    InventoryChangeType,
    InventoryItem,
    InventoryTransaction,
    InventoryUnit,
)
from app.models.user import User, UserRole
from app.schemas.inventory import (
    InventoryAdjustRequest,
    InventoryBroadcastResponse,
    InventoryItemCreate,
    InventoryItemResponse,
    PaginatedInventoryItemsResponse,
    PaginatedInventoryTransactionsResponse,
)
from app.services.audit import get_client_ip, record_audit_log

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _require_inventory_access(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.SUPER_ADMIN:
        return current_user
    if (
        current_user.role == UserRole.FRANCHISE_OWNER
        and "inventory:manage" in (current_user.permissions or [])
    ):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to access inventory",
    )


def _item_snapshot(item: InventoryItem) -> dict:
    return {
        "franchise_id": str(item.franchise_id),
        "item_name": item.item_name,
        "unit": item.unit.value,
        "current_stock": str(item.current_stock),
        "reorder_level": str(item.reorder_level),
        "is_active": item.is_active,
    }


@router.post("/items", response_model=InventoryBroadcastResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_items(
    payload: InventoryItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> InventoryBroadcastResponse:
    if payload.broadcast_all_active:
        target_franchises = db.scalars(
            select(Franchise).where(Franchise.is_active.is_(True), Franchise.deleted_at.is_(None))
        ).all()
        if not target_franchises:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active franchises found")
    else:
        franchise = db.scalar(
            select(Franchise).where(Franchise.id == payload.franchise_id, Franchise.deleted_at.is_(None))
        )
        if franchise is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target franchise not found")
        target_franchises = [franchise]

    created_items: list[InventoryItem] = []
    skipped_count = 0
    client_ip = get_client_ip(request)

    for outlet in target_franchises:
        exists = db.scalar(
            select(InventoryItem.id).where(
                InventoryItem.franchise_id == outlet.id,
                func.lower(InventoryItem.item_name) == payload.item_name.lower(),
                InventoryItem.deleted_at.is_(None),
            )
        )
        if exists is not None:
            if not payload.broadcast_all_active:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"'{payload.item_name}' already exists for outlet {outlet.outlet_code}",
                )
            skipped_count += 1
            continue

        item = InventoryItem(
            franchise_id=outlet.id,
            item_name=payload.item_name,
            unit=payload.unit,
            current_stock=payload.opening_stock,
            reorder_level=payload.reorder_level,
            is_active=True,
        )
        db.add(item)
        db.flush()

        db.add(
            InventoryTransaction(
                inventory_item_id=item.id,
                franchise_id=outlet.id,
                performed_by_id=current_user.id,
                change_type=InventoryChangeType.OPENING_STOCK,
                quantity_delta=payload.opening_stock,
                previous_stock=Decimal("0.00"),
                balance_after=payload.opening_stock,
                reference_type="initial_stock",
                reference_id=str(item.id),
                remarks="Initial opening stock",
            )
        )
        record_audit_log(
            db, actor_user_id=current_user.id, franchise_id=outlet.id, action="CREATE",
            entity_type="inventory_item", entity_id=item.id, old_values=None,
            new_values=_item_snapshot(item), ip_address=client_ip,
        )
        created_items.append(item)

    if created_items:
        db.add(
            ActivityLog(
                franchise_id=None if payload.broadcast_all_active else target_franchises[0].id,
                user_id=current_user.id,
                event_type="INVENTORY_ITEM_CREATED",
                description=f"Created supply '{payload.item_name}' for {len(created_items)} outlet(s)",
                ip_address=client_ip,
                user_agent=request.headers.get("User-Agent"),
            )
        )

    db.commit()
    for item in created_items:
        db.refresh(item)

    return InventoryBroadcastResponse(
        created_count=len(created_items),
        skipped_count=skipped_count,
        items=[InventoryItemResponse.model_validate(i) for i in created_items],
    )


@router.get("/items", response_model=PaginatedInventoryItemsResponse)
def list_inventory_items(
    franchise_id: UUID | None = Query(default=None),
    unit: InventoryUnit | None = Query(default=None),
    low_stock_only: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_inventory_access),
) -> PaginatedInventoryItemsResponse:
    filters = [InventoryItem.deleted_at.is_(None), InventoryItem.is_active.is_(True)]

    if current_user.role == UserRole.FRANCHISE_OWNER:
        filters.append(InventoryItem.franchise_id == current_user.franchise_id)
    elif franchise_id is not None:
        filters.append(InventoryItem.franchise_id == franchise_id)

    if unit is not None:
        filters.append(InventoryItem.unit == unit)
    if low_stock_only:
        filters.append(InventoryItem.current_stock <= InventoryItem.reorder_level)
    if search and search.strip():
        filters.append(InventoryItem.item_name.ilike(f"%{search.strip()}%"))

    total = db.scalar(select(func.count(InventoryItem.id)).where(*filters)) or 0
    items = db.scalars(
        select(InventoryItem).options(joinedload(InventoryItem.franchise)).where(*filters)
        .order_by(InventoryItem.item_name.asc()).offset((page - 1) * page_size).limit(page_size)
    ).all()

    return PaginatedInventoryItemsResponse(
        items=[InventoryItemResponse.model_validate(i) for i in items],
        total=total, page=page, page_size=page_size,
    )


@router.post("/items/{item_id}/adjust", response_model=InventoryItemResponse)
def adjust_inventory_stock(
    item_id: UUID,
    payload: InventoryAdjustRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_inventory_access),
) -> InventoryItemResponse:
    item = db.scalar(
        select(InventoryItem).options(joinedload(InventoryItem.franchise)).where(
            InventoryItem.id == item_id, InventoryItem.deleted_at.is_(None), InventoryItem.is_active.is_(True)
        ).with_for_update(of=InventoryItem)
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    if current_user.role == UserRole.FRANCHISE_OWNER and item.franchise_id != current_user.franchise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only adjust inventory for your own outlet")

    prev_stock = item.current_stock
    new_balance = prev_stock + payload.quantity_delta
    if new_balance < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock: current balance is {prev_stock} {item.unit.value}",
        )

    old_values = _item_snapshot(item)
    item.current_stock = new_balance
    change_enum = InventoryChangeType(payload.change_type)

    db.add(
        InventoryTransaction(
            inventory_item_id=item.id,
            franchise_id=item.franchise_id,
            performed_by_id=current_user.id,
            change_type=change_enum,
            quantity_delta=payload.quantity_delta,
            previous_stock=prev_stock,
            balance_after=new_balance,
            reference_type="manual_adjustment",
            reference_id=str(item.id),
            remarks=payload.remarks,
        )
    )
    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=item.franchise_id,
        action="STOCK_ADJUST", entity_type="inventory_item", entity_id=item.id,
        old_values=old_values, new_values=_item_snapshot(item), ip_address=get_client_ip(request),
    )
    db.add(
        ActivityLog(
            franchise_id=item.franchise_id, user_id=current_user.id,
            event_type="INVENTORY_ADJUSTED",
            description=f"{change_enum.value}: '{item.item_name}' {payload.quantity_delta:+} {item.unit.value} -> {new_balance}",
            ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    db.refresh(item)
    return InventoryItemResponse.model_validate(item)


@router.get("/transactions", response_model=PaginatedInventoryTransactionsResponse)
def list_inventory_transactions(
    franchise_id: UUID | None = Query(default=None),
    inventory_item_id: UUID | None = Query(default=None),
    change_type: InventoryChangeType | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_inventory_access),
) -> PaginatedInventoryTransactionsResponse:
    filters = []
    if current_user.role == UserRole.FRANCHISE_OWNER:
        filters.append(InventoryTransaction.franchise_id == current_user.franchise_id)
    elif franchise_id is not None:
        filters.append(InventoryTransaction.franchise_id == franchise_id)

    if inventory_item_id is not None:
        filters.append(InventoryTransaction.inventory_item_id == inventory_item_id)
    if change_type is not None:
        filters.append(InventoryTransaction.change_type == change_type)
    if start_date is not None:
        filters.append(InventoryTransaction.created_at >= datetime.combine(start_date, time.min, tzinfo=timezone.utc))
    if end_date is not None:
        filters.append(InventoryTransaction.created_at <= datetime.combine(end_date, time.max, tzinfo=timezone.utc))

    total = db.scalar(select(func.count(InventoryTransaction.id)).where(*filters)) or 0
    rows = db.scalars(
        select(InventoryTransaction)
        .options(joinedload(InventoryTransaction.inventory_item), joinedload(InventoryTransaction.performed_by))
        .where(*filters).order_by(InventoryTransaction.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()

    return PaginatedInventoryTransactionsResponse(items=rows, total=total, page=page, page_size=page_size)
