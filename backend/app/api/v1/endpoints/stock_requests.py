import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.franchise import Franchise
from app.models.inventory import InventoryChangeType, InventoryItem, InventoryTransaction
from app.models.stock_request import StockRequest, StockRequestItem, StockRequestStatus
from app.models.user import User, UserRole
from app.schemas.stock_request import (
    PaginatedStockRequestsResponse,
    StockRequestCreate,
    StockRequestResponse,
    StockRequestReview,
    StockRequestStatusAdvance,
)
from app.services.audit import get_client_ip, record_audit_log

router = APIRouter(prefix="/stock-requests", tags=["Stock Requests"])
logger = logging.getLogger("burger_calling_pos.stock_requests")
IST = ZoneInfo("Asia/Kolkata")


def _require_stock_request_creator(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.FRANCHISE_OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only franchise owners can submit stock requests")
    perms = current_user.permissions or []
    if "stock_requests:create" not in perms and "inventory:manage" not in perms:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission: stock_requests:create")
    return current_user


def _require_stock_request_viewer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.SUPER_ADMIN:
        return current_user
    if current_user.role == UserRole.FRANCHISE_OWNER:
        perms = current_user.permissions or []
        if "stock_requests:create" in perms or "inventory:manage" in perms:
            return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to view stock requests")


def _generate_request_number(db: Session, franchise: Franchise) -> str:
    today_ist = datetime.now(IST).strftime("%d%m%y")
    prefix = f"SR-{today_ist}-{franchise.outlet_code}-"
    existing_count = db.scalar(
        select(func.count(StockRequest.id)).where(
            StockRequest.franchise_id == franchise.id, StockRequest.request_number.like(f"{prefix}%")
        )
    ) or 0
    return f"{prefix}{existing_count + 1:03d}"


def _apply_delivery_credit(
    db: Session,
    stock_request: StockRequest,
    actor_user_id: UUID,
) -> None:
    if stock_request.inventory_applied:
        logger.info("StockRequest %s already has inventory_applied=True; skipping duplicate credit", stock_request.request_number)
        return
    logger.info("Step 5-6: Applying delivery credit for StockRequest %s (items=%d)", stock_request.request_number, len(stock_request.items))

    inv_ids = sorted({line.inventory_item_id for line in stock_request.items})
    locked_items = db.scalars(
        select(InventoryItem)
        .where(InventoryItem.id.in_(inv_ids))
        .order_by(InventoryItem.id.asc())
        .with_for_update(of=InventoryItem)
    ).all()
    inv_map = {item.id: item for item in locked_items}

    for line in stock_request.items:
        credit_qty = line.approved_qty if line.approved_qty is not None else line.requested_qty
        if credit_qty <= Decimal("0.00"):
            continue
        inv_item = inv_map.get(line.inventory_item_id)
        if inv_item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item '{line.item_name_snapshot}' missing",
            )
        prev_stock = inv_item.current_stock
        new_stock = prev_stock + credit_qty
        inv_item.current_stock = new_stock
        db.add(
            InventoryTransaction(
                inventory_item_id=inv_item.id,
                franchise_id=stock_request.franchise_id,
                performed_by_id=actor_user_id,
                change_type=InventoryChangeType.REQUEST_DELIVERED,
                quantity_delta=credit_qty,
                previous_stock=prev_stock,
                balance_after=new_stock,
                reference_type="stock_request",
                reference_id=str(stock_request.id),
                remarks=f"Stock request {stock_request.request_number} delivered",
            )
        )

    stock_request.inventory_applied = True
    stock_request.delivered_at = datetime.now(timezone.utc)
    logger.info("Step 7: Inventory updated & transactions queued for StockRequest %s", stock_request.request_number)


def _reverse_delivery_credit(
    db: Session,
    stock_request: StockRequest,
    actor_user_id: UUID,
    new_status: StockRequestStatus,
) -> None:
    if not stock_request.inventory_applied:
        return

    inv_ids = sorted({line.inventory_item_id for line in stock_request.items})
    locked_items = db.scalars(
        select(InventoryItem)
        .where(InventoryItem.id.in_(inv_ids))
        .order_by(InventoryItem.id.asc())
        .with_for_update(of=InventoryItem)
    ).all()
    inv_map = {item.id: item for item in locked_items}

    for line in stock_request.items:
        credit_qty = line.approved_qty if line.approved_qty is not None else line.requested_qty
        if credit_qty <= Decimal("0.00"):
            continue
        inv_item = inv_map.get(line.inventory_item_id)
        if inv_item is None:
            continue
        prev_stock = inv_item.current_stock
        if prev_stock - credit_qty < Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot reverse delivery: '{inv_item.item_name}' current stock ({prev_stock} {inv_item.unit.value}) "
                    f"is less than credited quantity ({credit_qty} {inv_item.unit.value})."
                ),
            )
        new_stock = prev_stock - credit_qty
        inv_item.current_stock = new_stock
        db.add(
            InventoryTransaction(
                inventory_item_id=inv_item.id,
                franchise_id=stock_request.franchise_id,
                performed_by_id=actor_user_id,
                change_type=InventoryChangeType.CORRECTION,
                quantity_delta=-credit_qty,
                previous_stock=prev_stock,
                balance_after=new_stock,
                reference_type="stock_request",
                reference_id=str(stock_request.id),
                remarks=f"Reversed delivery for {stock_request.request_number} (status changed to {new_status.value})",
            )
        )

    stock_request.inventory_applied = False
    stock_request.delivered_at = None


@router.post("", response_model=StockRequestResponse, status_code=status.HTTP_201_CREATED)
def create_stock_request(
    payload: StockRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_stock_request_creator),
) -> StockRequestResponse:
    franchise = db.scalar(
        select(Franchise).where(
            Franchise.id == current_user.franchise_id, Franchise.is_active.is_(True), Franchise.deleted_at.is_(None)
        ).with_for_update()
    )
    if franchise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active franchise outlet not found")

    item_ids = [line.inventory_item_id for line in payload.items]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Duplicate inventory items are not allowed")

    inv_items = db.scalars(
        select(InventoryItem).where(
            InventoryItem.id.in_(item_ids), InventoryItem.franchise_id == franchise.id,
            InventoryItem.is_active.is_(True), InventoryItem.deleted_at.is_(None),
        )
    ).all()
    inv_map = {item.id: item for item in inv_items}
    if len(inv_map) != len(item_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more supply items do not belong to your outlet")

    request_number = _generate_request_number(db, franchise)
    stock_request = StockRequest(
        request_number=request_number, franchise_id=franchise.id, requested_by_id=current_user.id,
        status=StockRequestStatus.PENDING, inventory_applied=False,
        remarks=payload.remarks.strip() if payload.remarks else None,
    )
    db.add(stock_request)
    db.flush()

    for line in payload.items:
        inv_item = inv_map[line.inventory_item_id]
        db.add(
            StockRequestItem(
                stock_request_id=stock_request.id, inventory_item_id=inv_item.id,
                item_name_snapshot=inv_item.item_name, unit_snapshot=inv_item.unit.value,
                requested_qty=line.requested_qty, approved_qty=None,
            )
        )

    client_ip = get_client_ip(request)
    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=franchise.id, action="CREATE",
        entity_type="stock_request", entity_id=stock_request.id, old_values=None,
        new_values={"request_number": request_number, "status": StockRequestStatus.PENDING.value},
        ip_address=client_ip,
    )
    db.add(
        ActivityLog(
            franchise_id=franchise.id, user_id=current_user.id, event_type="STOCK_REQUESTED",
            description=f"Submitted stock request {request_number} ({len(payload.items)} item(s))",
            ip_address=client_ip, user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    logger.info("Step 8-9: Committed StockRequest %s status=%s", stock_request.request_number, stock_request.status.value)
    db.refresh(stock_request)
    return StockRequestResponse.model_validate(stock_request)


@router.get("", response_model=PaginatedStockRequestsResponse)
def list_stock_requests(
    franchise_id: UUID | None = Query(default=None),
    status_filter: StockRequestStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_stock_request_viewer),
) -> PaginatedStockRequestsResponse:
    filters = []
    if current_user.role == UserRole.FRANCHISE_OWNER:
        filters.append(StockRequest.franchise_id == current_user.franchise_id)
    elif franchise_id is not None:
        filters.append(StockRequest.franchise_id == franchise_id)

    if status_filter is not None:
        filters.append(StockRequest.status == status_filter)

    total = db.scalar(select(func.count(StockRequest.id)).where(*filters)) or 0
    rows = (
        db.scalars(
            select(StockRequest)
            .options(
                joinedload(StockRequest.franchise), joinedload(StockRequest.requested_by),
                joinedload(StockRequest.reviewed_by), joinedload(StockRequest.items),
            )
            .where(*filters).order_by(StockRequest.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        ).unique().all()
    )
    return PaginatedStockRequestsResponse(
        items=[StockRequestResponse.model_validate(r) for r in rows],
        total=total, page=page, page_size=page_size,
    )


@router.patch("/{request_id}/review", response_model=StockRequestResponse)
def review_stock_request(
    request_id: UUID,
    payload: StockRequestReview,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> StockRequestResponse:
    stock_request = (
        db.scalars(
            select(StockRequest).options(joinedload(StockRequest.items))
            .where(StockRequest.id == request_id).with_for_update(of=StockRequest)
        ).unique().first()
    )
    if stock_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock request not found")

    if stock_request.status != StockRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only pending requests can be reviewed (current: {stock_request.status.value})",
        )

    old_status = stock_request.status.value
    stock_request.reviewed_by_id = current_user.id
    stock_request.reviewed_at = datetime.now(timezone.utc)
    stock_request.admin_notes = payload.admin_notes.strip() if payload.admin_notes else None

    if payload.decision == "rejected":
        stock_request.status = StockRequestStatus.REJECTED
        for line in stock_request.items:
            line.approved_qty = Decimal("0.00")
    else:
        stock_request.status = StockRequestStatus.APPROVED
        override_map = {i.item_id: i.approved_qty for i in payload.items} if payload.items else {}
        for line in stock_request.items:
            line.approved_qty = override_map.get(line.id, line.requested_qty)

    client_ip = get_client_ip(request)
    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=stock_request.franchise_id,
        action="REVIEW", entity_type="stock_request", entity_id=stock_request.id,
        old_values={"status": old_status}, new_values={"status": stock_request.status.value},
        ip_address=client_ip,
    )
    db.add(
        ActivityLog(
            franchise_id=stock_request.franchise_id, user_id=current_user.id,
            event_type=f"STOCK_REQUEST_{stock_request.status.value.upper()}",
            description=f"{stock_request.status.value.title()} stock request {stock_request.request_number}",
            ip_address=client_ip, user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    logger.info("Step 8-9: Committed StockRequest %s status=%s", stock_request.request_number, stock_request.status.value)
    db.refresh(stock_request)
    return StockRequestResponse.model_validate(stock_request)


@router.patch("/{request_id}/status", response_model=StockRequestResponse)
def update_stock_request_status(
    request_id: UUID,
    payload: StockRequestStatusAdvance,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> StockRequestResponse:
    stock_request = (
        db.scalars(
            select(StockRequest).options(joinedload(StockRequest.items))
            .where(StockRequest.id == request_id).with_for_update(of=StockRequest)
        ).unique().first()
    )
    if stock_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock request not found")

    target_status = payload.next_status
    if stock_request.status == target_status:
        return StockRequestResponse.model_validate(stock_request)

    old_status = stock_request.status.value

    # If moving from pending/rejected/cancelled into an active fulfillment stage, ensure approved_qty is populated
    if target_status in (
        StockRequestStatus.APPROVED,
        StockRequestStatus.PACKED,
        StockRequestStatus.DISPATCHED,
        StockRequestStatus.DELIVERED,
    ):
        if stock_request.reviewed_by_id is None:
            stock_request.reviewed_by_id = current_user.id
            stock_request.reviewed_at = datetime.now(timezone.utc)
        for line in stock_request.items:
            if line.approved_qty is None or (old_status in ("rejected", "cancelled") and line.approved_qty == Decimal("0.00")):
                line.approved_qty = line.requested_qty

    # Reversal if leaving DELIVERED
    if stock_request.status == StockRequestStatus.DELIVERED and target_status != StockRequestStatus.DELIVERED:
        _reverse_delivery_credit(db, stock_request, current_user.id, target_status)

    # Credit inventory if entering DELIVERED (idempotent via inventory_applied)
    if target_status == StockRequestStatus.DELIVERED:
        _apply_delivery_credit(db, stock_request, current_user.id)

    stock_request.status = target_status
    if payload.admin_notes and payload.admin_notes.strip():
        stock_request.admin_notes = payload.admin_notes.strip()

    client_ip = get_client_ip(request)
    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=stock_request.franchise_id,
        action="STATUS_UPDATE", entity_type="stock_request", entity_id=stock_request.id,
        old_values={"status": old_status}, new_values={"status": target_status.value},
        ip_address=client_ip,
    )
    db.add(
        ActivityLog(
            franchise_id=stock_request.franchise_id, user_id=current_user.id,
            event_type=f"STOCK_REQUEST_{target_status.value.upper()}",
            description=f"Stock request {stock_request.request_number} changed from {old_status} to {target_status.value}",
            ip_address=client_ip, user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    logger.info("Step 8-9: Committed StockRequest %s status=%s", stock_request.request_number, stock_request.status.value)
    db.refresh(stock_request)
    return StockRequestResponse.model_validate(stock_request)
