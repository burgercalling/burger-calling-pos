import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.franchise import Franchise
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.stock_request import StockRequest, StockRequestItem
from app.models.user import User, UserRole
from app.schemas.analytics import (
    DailySalesRow,
    InventoryReportRow,
    MonthlySalesRow,
    PaymentSalesRow,
    ProductSalesRow,
    StockRequestReportRow,
)

router = APIRouter(prefix="/reports", tags=["Reports"])
IST = ZoneInfo("Asia/Kolkata")


def _require_report_scope(requested_franchise_id: UUID | None, current_user: User) -> UUID | None:
    if current_user.role == UserRole.SUPER_ADMIN:
        return requested_franchise_id
    if current_user.role == UserRole.FRANCHISE_OWNER:
        perms = current_user.permissions or []
        if "reports:outlet_analytics" not in perms and "reports:today_sales" not in perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission to view outlet reports")
        return current_user.franchise_id
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cashiers cannot access analytical reports")


def _resolve_dates(start_date: date | None, end_date: date | None) -> tuple[date, date]:
    today = datetime.now(IST).date()
    resolved_end = end_date or today
    resolved_start = start_date or (resolved_end - timedelta(days=29))
    if resolved_start > resolved_end:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="start_date cannot be after end_date")
    return resolved_start, resolved_end


def _csv_response(filename: str, headers: list[str], rows: list[list[Any]]) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/daily-sales")
def daily_sales_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    franchise_id: UUID | None = Query(default=None),
    format: Literal["json", "csv"] = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_franchise = _require_report_scope(franchise_id, current_user)
    s_date, e_date = _resolve_dates(start_date, end_date)
    filters = [Order.status == OrderStatus.COMPLETED, Order.bill_date >= s_date, Order.bill_date <= e_date]
    if scoped_franchise is not None:
        filters.append(Order.franchise_id == scoped_franchise)

    rows = db.execute(
        select(
            Order.bill_date,
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.subtotal), Decimal("0.00")).label("gross_sales"),
            func.coalesce(func.sum(Order.discount_amount), Decimal("0.00")).label("discounts"),
            func.coalesce(func.sum(Order.grand_total), Decimal("0.00")).label("net_sales"),
        ).where(*filters).group_by(Order.bill_date).order_by(Order.bill_date.desc())
    ).all()

    data = [
        DailySalesRow(
            bill_date=r.bill_date, order_count=int(r.order_count),
            gross_sales=Decimal(r.gross_sales), discounts=Decimal(r.discounts), net_sales=Decimal(r.net_sales),
        )
        for r in rows
    ]
    if format == "csv":
        return _csv_response(
            f"daily-sales-{s_date}-to-{e_date}.csv",
            ["Date", "Orders", "Gross Sales (INR)", "Discounts (INR)", "Net Sales (INR)"],
            [[d.bill_date.isoformat(), d.order_count, str(d.gross_sales), str(d.discounts), str(d.net_sales)] for d in data],
        )
    return data


@router.get("/monthly-sales")
def monthly_sales_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    franchise_id: UUID | None = Query(default=None),
    format: Literal["json", "csv"] = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_franchise = _require_report_scope(franchise_id, current_user)
    today = datetime.now(IST).date()
    s_date = start_date or (today - timedelta(days=365))
    e_date = end_date or today
    month_expr = func.to_char(Order.bill_date, "YYYY-MM")
    filters = [Order.status == OrderStatus.COMPLETED, Order.bill_date >= s_date, Order.bill_date <= e_date]
    if scoped_franchise is not None:
        filters.append(Order.franchise_id == scoped_franchise)

    rows = db.execute(
        select(
            month_expr.label("month"),
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.grand_total), Decimal("0.00")).label("revenue"),
        ).where(*filters).group_by(month_expr).order_by(month_expr.asc())
    ).all()

    data: list[MonthlySalesRow] = []
    prev_revenue: Decimal | None = None
    for r in rows:
        rev = Decimal(r.revenue)
        growth = (
            (((rev - prev_revenue) / prev_revenue) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if prev_revenue is not None and prev_revenue > Decimal("0.00")
            else None
        )
        data.append(MonthlySalesRow(month=r.month, order_count=int(r.order_count), revenue=rev, growth_percent=growth))
        prev_revenue = rev
    data.reverse()

    if format == "csv":
        return _csv_response(
            f"monthly-sales-{s_date}-to-{e_date}.csv",
            ["Month", "Orders", "Revenue (INR)", "MoM Growth (%)"],
            [[d.month, d.order_count, str(d.revenue), str(d.growth_percent) if d.growth_percent is not None else ""] for d in data],
        )
    return data


@router.get("/product-sales")
def product_sales_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    franchise_id: UUID | None = Query(default=None),
    format: Literal["json", "csv"] = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_franchise = _require_report_scope(franchise_id, current_user)
    s_date, e_date = _resolve_dates(start_date, end_date)
    filters = [Order.status == OrderStatus.COMPLETED, Order.bill_date >= s_date, Order.bill_date <= e_date]
    if scoped_franchise is not None:
        filters.append(Order.franchise_id == scoped_franchise)

    rows = db.execute(
        select(
            Product.id, Product.name, Category.name.label("category_name"), Product.item_type,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("qty_sold"),
            func.coalesce(func.sum(OrderItem.line_total), Decimal("0.00")).label("total_revenue"),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Category, Category.id == Product.category_id)
        .where(*filters)
        .group_by(Product.id, Product.name, Category.name, Product.item_type)
        .order_by(func.sum(OrderItem.line_total).desc())
    ).all()

    data = [
        ProductSalesRow(
            product_id=r.id, product_name=r.name, category_name=r.category_name,
            item_type=r.item_type.value, qty_sold=int(r.qty_sold), total_revenue=Decimal(r.total_revenue),
        )
        for r in rows
    ]
    if format == "csv":
        return _csv_response(
            f"product-sales-{s_date}-to-{e_date}.csv",
            ["Product", "Category", "Item Type", "Qty Sold", "Revenue (INR)"],
            [[d.product_name, d.category_name, d.item_type, d.qty_sold, str(d.total_revenue)] for d in data],
        )
    return data


@router.get("/payment-sales")
def payment_sales_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    franchise_id: UUID | None = Query(default=None),
    format: Literal["json", "csv"] = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_franchise = _require_report_scope(franchise_id, current_user)
    s_date, e_date = _resolve_dates(start_date, end_date)
    filters = [Order.status == OrderStatus.COMPLETED, Order.bill_date >= s_date, Order.bill_date <= e_date]
    if scoped_franchise is not None:
        filters.append(Order.franchise_id == scoped_franchise)

    rows = db.execute(
        select(
            Order.payment_mode, func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.grand_total), Decimal("0.00")).label("total_amount"),
        ).where(*filters).group_by(Order.payment_mode).order_by(func.sum(Order.grand_total).desc())
    ).all()

    grand = sum((Decimal(r.total_amount) for r in rows), Decimal("0.00"))
    data = [
        PaymentSalesRow(
            payment_mode=r.payment_mode.value, order_count=int(r.order_count),
            total_amount=Decimal(r.total_amount),
            share_percent=(
                (Decimal(r.total_amount) / grand * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if grand > Decimal("0.00") else Decimal("0.00")
            ),
        )
        for r in rows
    ]
    if format == "csv":
        return _csv_response(
            f"payment-sales-{s_date}-to-{e_date}.csv",
            ["Payment Mode", "Orders", "Total Amount (INR)", "Share (%)"],
            [[d.payment_mode.upper(), d.order_count, str(d.total_amount), str(d.share_percent)] for d in data],
        )
    return data


@router.get("/inventory")
def inventory_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    franchise_id: UUID | None = Query(default=None),
    format: Literal["json", "csv"] = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_franchise = _require_report_scope(franchise_id, current_user)
    s_date, e_date = _resolve_dates(start_date, end_date)
    start_dt = datetime.combine(s_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(e_date, time.max, tzinfo=timezone.utc)

    item_filters = [InventoryItem.is_active.is_(True), InventoryItem.deleted_at.is_(None)]
    if scoped_franchise is not None:
        item_filters.append(InventoryItem.franchise_id == scoped_franchise)

    inward_expr = func.coalesce(
        func.sum(case((InventoryTransaction.quantity_delta > 0, InventoryTransaction.quantity_delta), else_=Decimal("0.00"))),
        Decimal("0.00"),
    )
    outward_expr = func.coalesce(
        func.sum(case((InventoryTransaction.quantity_delta < 0, func.abs(InventoryTransaction.quantity_delta)), else_=Decimal("0.00"))),
        Decimal("0.00"),
    )

    rows = db.execute(
        select(
            InventoryItem.id, Franchise.outlet_code, Franchise.name.label("outlet_name"),
            InventoryItem.item_name, InventoryItem.unit, InventoryItem.current_stock,
            InventoryItem.reorder_level, inward_expr.label("total_inward"), outward_expr.label("total_outward"),
        )
        .join(Franchise, Franchise.id == InventoryItem.franchise_id)
        .outerjoin(
            InventoryTransaction,
            (InventoryTransaction.inventory_item_id == InventoryItem.id)
            & (InventoryTransaction.created_at >= start_dt)
            & (InventoryTransaction.created_at <= end_dt),
        )
        .where(*item_filters)
        .group_by(
            InventoryItem.id, Franchise.outlet_code, Franchise.name,
            InventoryItem.item_name, InventoryItem.unit, InventoryItem.current_stock, InventoryItem.reorder_level,
        )
        .order_by(Franchise.outlet_code.asc(), InventoryItem.item_name.asc())
    ).all()

    data = [
        InventoryReportRow(
            inventory_item_id=r.id, outlet_code=r.outlet_code, outlet_name=r.outlet_name,
            item_name=r.item_name, unit=r.unit.value, current_stock=Decimal(r.current_stock),
            reorder_level=Decimal(r.reorder_level), is_low_stock=Decimal(r.current_stock) <= Decimal(r.reorder_level),
            total_inward=Decimal(r.total_inward), total_outward=Decimal(r.total_outward),
        )
        for r in rows
    ]
    if format == "csv":
        return _csv_response(
            f"inventory-report-{s_date}-to-{e_date}.csv",
            ["Outlet Code", "Outlet Name", "Supply Item", "Unit", "Current Stock", "Reorder Level", "Low Stock", "Total Inward", "Total Outward"],
            [[d.outlet_code, d.outlet_name, d.item_name, d.unit, str(d.current_stock), str(d.reorder_level), "YES" if d.is_low_stock else "NO", str(d.total_inward), str(d.total_outward)] for d in data],
        )
    return data


@router.get("/stock-requests")
def stock_request_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    franchise_id: UUID | None = Query(default=None),
    format: Literal["json", "csv"] = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_franchise = _require_report_scope(franchise_id, current_user)
    s_date, e_date = _resolve_dates(start_date, end_date)
    start_dt = datetime.combine(s_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(e_date, time.max, tzinfo=timezone.utc)

    filters = [StockRequest.created_at >= start_dt, StockRequest.created_at <= end_dt]
    if scoped_franchise is not None:
        filters.append(StockRequest.franchise_id == scoped_franchise)

    rows = db.execute(
        select(
            StockRequest.request_number, Franchise.outlet_code, Franchise.name.label("outlet_name"),
            StockRequest.status,
            func.coalesce(func.sum(StockRequestItem.requested_qty), Decimal("0.00")).label("req_total"),
            func.coalesce(func.sum(StockRequestItem.approved_qty), Decimal("0.00")).label("appr_total"),
            StockRequest.created_at, StockRequest.delivered_at,
        )
        .join(Franchise, Franchise.id == StockRequest.franchise_id)
        .join(StockRequestItem, StockRequestItem.stock_request_id == StockRequest.id)
        .where(*filters)
        .group_by(
            StockRequest.id, StockRequest.request_number, Franchise.outlet_code,
            Franchise.name, StockRequest.status, StockRequest.created_at, StockRequest.delivered_at,
        )
        .order_by(StockRequest.created_at.desc())
    ).all()

    data = [
        StockRequestReportRow(
            request_number=r.request_number, outlet_code=r.outlet_code, outlet_name=r.outlet_name,
            status=r.status.value, requested_qty_total=Decimal(r.req_total),
            approved_qty_total=Decimal(r.appr_total), created_at=r.created_at, delivered_at=r.delivered_at,
        )
        for r in rows
    ]
    if format == "csv":
        return _csv_response(
            f"stock-requests-{s_date}-to-{e_date}.csv",
            ["Request Number", "Outlet Code", "Outlet Name", "Status", "Requested Qty Total", "Approved Qty Total", "Created At", "Delivered At"],
            [[d.request_number, d.outlet_code, d.outlet_name, d.status, str(d.requested_qty_total), str(d.approved_qty_total), d.created_at.isoformat(), d.delivered_at.isoformat() if d.delivered_at else ""] for d in data],
        )
    return data
