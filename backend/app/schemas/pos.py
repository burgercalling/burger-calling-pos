from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.order import OrderStatus, OrderType, PaymentMode
from app.models.setting import PrinterWidthMode


class OrderItemInput(BaseModel):
    product_id: UUID
    quantity: int = Field(..., ge=1, le=500)


class CreateOrderRequest(BaseModel):
    order_type: OrderType = OrderType.DINE_IN
    order_source: str | None = Field(default=None, max_length=50)
    external_order_number: str | None = Field(default=None, max_length=100)
    table_number: str | None = Field(default=None, max_length=20)
    payment_mode: PaymentMode = PaymentMode.CASH
    items: list[OrderItemInput] = Field(..., min_length=1)
    discount_type: Literal["none", "flat", "percent"] = "none"
    discount_value: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    customer_phone: str | None = Field(default=None, max_length=20)
    customer_name: str | None = Field(default=None, max_length=150)
    print_kot: bool = True

    @field_validator("customer_phone", "customer_name", "external_order_number", "table_number")
    @classmethod
    def strip_optional_str(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None

    @field_validator("order_source")
    @classmethod
    def normalize_order_source(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip().lower()
        return cleaned or None

    @model_validator(mode="after")
    def validate_source_requirements(self) -> "CreateOrderRequest":
        src = self.order_source or self.order_type.value
        self.order_source = src
        if src in ("swiggy", "zomato"):
            if not self.external_order_number:
                raise ValueError(f"{src.title()} Order Number is required")
        elif src == "takeaway":
            if not self.customer_phone:
                raise ValueError("Customer Phone is required for Take Away orders")
        return self


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    product_name_snapshot: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    franchise_id: UUID
    name: str | None
    phone: str
    total_orders: int
    total_spent: Decimal
    created_at: datetime
    updated_at: datetime


class ReceiptSettingsPayload(BaseModel):
    brand_name: str
    logo_url: str | None
    receipt_footer: str
    tax_enabled: bool
    tax_label: str
    tax_rate: Decimal
    gstin: str | None
    currency_symbol: str
    printer_width_mode: PrinterWidthMode
    outlet_name: str
    outlet_code: str
    outlet_address: str
    outlet_phone: str


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bill_number: str
    bill_date: date
    daily_sequence: int
    franchise_id: UUID
    cashier_id: UUID
    customer_id: UUID | None
    order_type: OrderType
    order_source: str
    external_order_number: str | None = None
    customer_name_snapshot: str | None = None
    table_number: str | None = None
    payment_mode: PaymentMode
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    kot_printed: bool
    reprint_count: int
    status: OrderStatus
    created_at: datetime
    customer: CustomerResponse | None = None
    items: list[OrderItemResponse]


class OrderReceiptResponse(BaseModel):
    order: OrderResponse
    cashier_name: str
    is_duplicate: bool
    receipt_settings: ReceiptSettingsPayload


class TodayOrdersSummaryResponse(BaseModel):
    bill_date: date
    total_orders: int
    total_revenue: Decimal
    cash_total: Decimal
    upi_total: Decimal
    card_total: Decimal
    split_total: Decimal
    orders: list[OrderResponse]
