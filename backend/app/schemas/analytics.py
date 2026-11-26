from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class RecentOrderRow(BaseModel):
    id: UUID
    bill_number: str
    outlet_code: str | None = None
    outlet_name: str | None = None
    order_type: str
    payment_mode: str
    grand_total: Decimal
    created_at: datetime


class LowStockAlertRow(BaseModel):
    id: UUID
    franchise_id: UUID
    outlet_code: str
    outlet_name: str
    item_name: str
    unit: str
    current_stock: Decimal
    reorder_level: Decimal


class OutletDashboardResponse(BaseModel):
    bill_date: date
    today_sales: Decimal
    today_orders: int
    avg_order_value: Decimal
    yesterday_sales: Decimal
    sales_delta_percent: Decimal
    recent_orders: list[RecentOrderRow]
    low_stock_alerts: list[LowStockAlertRow]


class OutletLeaderboardRow(BaseModel):
    franchise_id: UUID
    outlet_code: str
    outlet_name: str
    city: str
    today_orders: int
    today_revenue: Decimal


class MasterDashboardResponse(BaseModel):
    bill_date: date
    network_today_sales: Decimal
    network_today_orders: int
    active_outlets_count: int
    pending_stock_requests_count: int
    low_stock_alerts_count: int
    outlet_leaderboard: list[OutletLeaderboardRow]
    network_low_stock_alerts: list[LowStockAlertRow]
    recent_orders: list[RecentOrderRow]


class DailySalesRow(BaseModel):
    bill_date: date
    order_count: int
    gross_sales: Decimal
    discounts: Decimal
    net_sales: Decimal


class MonthlySalesRow(BaseModel):
    month: str
    order_count: int
    revenue: Decimal
    growth_percent: Decimal | None


class ProductSalesRow(BaseModel):
    product_id: UUID
    product_name: str
    category_name: str
    item_type: str
    qty_sold: int
    total_revenue: Decimal


class PaymentSalesRow(BaseModel):
    payment_mode: str
    order_count: int
    total_amount: Decimal
    share_percent: Decimal


class InventoryReportRow(BaseModel):
    inventory_item_id: UUID
    outlet_code: str
    outlet_name: str
    item_name: str
    unit: str
    current_stock: Decimal
    reorder_level: Decimal
    is_low_stock: bool
    total_inward: Decimal
    total_outward: Decimal


class StockRequestReportRow(BaseModel):
    request_number: str
    outlet_code: str
    outlet_name: str
    status: str
    requested_qty_total: Decimal
    approved_qty_total: Decimal
    created_at: datetime
    delivered_at: datetime | None
