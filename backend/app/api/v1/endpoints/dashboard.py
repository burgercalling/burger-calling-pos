from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.franchise import Franchise
from app.models.inventory import InventoryItem
from app.models.order import Order, OrderStatus
from app.models.stock_request import StockRequest, StockRequestStatus
from app.models.user import User, UserRole
from app.schemas.analytics import (
    LowStockAlertRow,
    MasterDashboardResponse,
    OutletDashboardResponse,
    OutletLeaderboardRow,
    RecentOrderRow,
)
from app.services.billing import get_effective_setting

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/outlet", response_model=OutletDashboardResponse)
def get_outlet_dashboard(
    franchise_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OutletDashboardResponse:
    if current_user.role == UserRole.SUPER_ADMIN:
        if franchise_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="franchise_id is required")
        target_franchise_id = franchise_id
    else:
        if current_user.franchise_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No outlet assigned")
        target_franchise_id = current_user.franchise_id

    setting = get_effective_setting(db, target_franchise_id)
    today_date = datetime.now(ZoneInfo(setting.timezone or "Asia/Kolkata")).date()
    yesterday_date = today_date - timedelta(days=1)

    today_agg = db.execute(
        select(
            func.coalesce(func.sum(Order.grand_total), Decimal("0.00")),
            func.count(Order.id),
        ).where(
            Order.franchise_id == target_franchise_id,
            Order.bill_date == today_date,
            Order.status == OrderStatus.COMPLETED,
        )
    ).one()
    today_sales = Decimal(today_agg[0])
    today_orders = int(today_agg[1])

    avg_order_value = (
        (today_sales / today_orders).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if today_orders > 0
        else Decimal("0.00")
    )
    yesterday_sales = db.scalar(
        select(func.coalesce(func.sum(Order.grand_total), Decimal("0.00"))).where(
            Order.franchise_id == target_franchise_id,
            Order.bill_date == yesterday_date,
            Order.status == OrderStatus.COMPLETED,
        )
    ) or Decimal("0.00")

    if yesterday_sales > Decimal("0.00"):
        sales_delta_percent = (((today_sales - yesterday_sales) / yesterday_sales) * Decimal("100.00")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        sales_delta_percent = Decimal("100.00") if today_sales > 0 else Decimal("0.00")

    recent_orders_rows = (
        db.scalars(
            select(Order).options(joinedload(Order.franchise))
            .where(Order.franchise_id == target_franchise_id, Order.status == OrderStatus.COMPLETED)
            .order_by(Order.created_at.desc()).limit(10)
        ).unique().all()
    )
    recent_orders = [
        RecentOrderRow(
            id=o.id, bill_number=o.bill_number,
            outlet_code=o.franchise.outlet_code if o.franchise else None,
            outlet_name=o.franchise.name if o.franchise else None,
            order_type=o.order_type.value, payment_mode=o.payment_mode.value,
            grand_total=o.grand_total, created_at=o.created_at,
        )
        for o in recent_orders_rows
    ]

    low_stock_rows = db.scalars(
        select(InventoryItem).options(joinedload(InventoryItem.franchise)).where(
            InventoryItem.franchise_id == target_franchise_id,
            InventoryItem.is_active.is_(True), InventoryItem.deleted_at.is_(None),
            InventoryItem.current_stock <= InventoryItem.reorder_level,
        ).order_by(InventoryItem.current_stock.asc()).limit(15)
    ).all()
    low_stock_alerts = [
        LowStockAlertRow(
            id=item.id, franchise_id=item.franchise_id,
            outlet_code=item.franchise.outlet_code, outlet_name=item.franchise.name,
            item_name=item.item_name, unit=item.unit.value,
            current_stock=item.current_stock, reorder_level=item.reorder_level,
        )
        for item in low_stock_rows
    ]

    return OutletDashboardResponse(
        bill_date=today_date, today_sales=today_sales, today_orders=today_orders,
        avg_order_value=avg_order_value, yesterday_sales=yesterday_sales,
        sales_delta_percent=sales_delta_percent, recent_orders=recent_orders,
        low_stock_alerts=low_stock_alerts,
    )


@router.get("/master", response_model=MasterDashboardResponse)
def get_master_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> MasterDashboardResponse:
    today_date = datetime.now(IST).date()

    network_agg = db.execute(
        select(
            func.coalesce(func.sum(Order.grand_total), Decimal("0.00")),
            func.count(Order.id),
        ).where(Order.bill_date == today_date, Order.status == OrderStatus.COMPLETED)
    ).one()

    active_outlets_count = db.scalar(
        select(func.count(Franchise.id)).where(Franchise.is_active.is_(True), Franchise.deleted_at.is_(None))
    ) or 0
    pending_stock_requests_count = db.scalar(
        select(func.count(StockRequest.id)).where(StockRequest.status == StockRequestStatus.PENDING)
    ) or 0
    low_stock_alerts_count = db.scalar(
        select(func.count(InventoryItem.id)).where(
            InventoryItem.is_active.is_(True), InventoryItem.deleted_at.is_(None),
            InventoryItem.current_stock <= InventoryItem.reorder_level,
        )
    ) or 0

    leaderboard_rows = db.execute(
        select(
            Franchise.id, Franchise.outlet_code, Franchise.name, Franchise.city,
            func.count(Order.id).label("today_orders"),
            func.coalesce(func.sum(Order.grand_total), Decimal("0.00")).label("today_revenue"),
        )
        .outerjoin(
            Order,
            (Order.franchise_id == Franchise.id) & (Order.bill_date == today_date) & (Order.status == OrderStatus.COMPLETED),
        )
        .where(Franchise.is_active.is_(True), Franchise.deleted_at.is_(None))
        .group_by(Franchise.id, Franchise.outlet_code, Franchise.name, Franchise.city)
        .order_by(func.coalesce(func.sum(Order.grand_total), Decimal("0.00")).desc())
    ).all()

    outlet_leaderboard = [
        OutletLeaderboardRow(
            franchise_id=r.id, outlet_code=r.outlet_code, outlet_name=r.name,
            city=r.city, today_orders=int(r.today_orders), today_revenue=Decimal(r.today_revenue),
        )
        for r in leaderboard_rows
    ]

    low_stock_rows = db.scalars(
        select(InventoryItem).options(joinedload(InventoryItem.franchise)).where(
            InventoryItem.is_active.is_(True), InventoryItem.deleted_at.is_(None),
            InventoryItem.current_stock <= InventoryItem.reorder_level,
        ).order_by(InventoryItem.current_stock.asc()).limit(15)
    ).all()
    network_low_stock_alerts = [
        LowStockAlertRow(
            id=item.id, franchise_id=item.franchise_id,
            outlet_code=item.franchise.outlet_code, outlet_name=item.franchise.name,
            item_name=item.item_name, unit=item.unit.value,
            current_stock=item.current_stock, reorder_level=item.reorder_level,
        )
        for item in low_stock_rows
    ]

    recent_orders_rows = (
        db.scalars(
            select(Order).options(joinedload(Order.franchise))
            .where(Order.status == OrderStatus.COMPLETED)
            .order_by(Order.created_at.desc()).limit(10)
        ).unique().all()
    )
    recent_orders = [
        RecentOrderRow(
            id=o.id, bill_number=o.bill_number,
            outlet_code=o.franchise.outlet_code if o.franchise else None,
            outlet_name=o.franchise.name if o.franchise else None,
            order_type=o.order_type.value, payment_mode=o.payment_mode.value,
            grand_total=o.grand_total, created_at=o.created_at,
        )
        for o in recent_orders_rows
    ]

    return MasterDashboardResponse(
        bill_date=today_date, network_today_sales=Decimal(network_agg[0]),
        network_today_orders=int(network_agg[1]), active_outlets_count=int(active_outlets_count),
        pending_stock_requests_count=int(pending_stock_requests_count),
        low_stock_alerts_count=int(low_stock_alerts_count),
        outlet_leaderboard=outlet_leaderboard,
        network_low_stock_alerts=network_low_stock_alerts,
        recent_orders=recent_orders,
    )
