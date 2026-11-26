from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.customer import Customer
from app.models.order import Order, OrderItem, OrderStatus, PaymentMode
from app.models.product import Product
from app.models.setting import Setting
from app.models.user import User
from app.schemas.pos import (
    CreateOrderRequest,
    OrderReceiptResponse,
    OrderResponse,
    ReceiptSettingsPayload,
    TodayOrdersSummaryResponse,
)
from app.services.audit import get_client_ip
from app.services.billing import generate_atomic_bill_number, get_effective_setting

router = APIRouter(prefix="/pos", tags=["POS Billing"])


def _build_receipt_settings(order: Order, setting: Setting) -> ReceiptSettingsPayload:
    return ReceiptSettingsPayload(
        brand_name=setting.brand_name,
        logo_url=setting.logo_url,
        receipt_footer=setting.receipt_footer,
        tax_enabled=setting.tax_enabled,
        tax_label=setting.tax_label,
        tax_rate=setting.tax_rate,
        gstin=setting.gstin,
        currency_symbol=setting.currency_symbol,
        printer_width_mode=setting.printer_width_mode,
        outlet_name=order.franchise.name,
        outlet_code=order.franchise.outlet_code,
        outlet_address=order.franchise.address,
        outlet_phone=order.franchise.phone,
    )


@router.post("/orders", response_model=OrderReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_pos_order(
    payload: CreateOrderRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pos:create_order")),
) -> OrderReceiptResponse:
    if current_user.franchise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="POS orders must be created from an outlet account")

    franchise_id = current_user.franchise_id
    setting = get_effective_setting(db, franchise_id)

    product_ids = [line.product_id for line in payload.items]
    products = db.scalars(
        select(Product).where(
            Product.id.in_(product_ids), Product.is_active.is_(True),
            Product.is_available.is_(True), Product.deleted_at.is_(None),
        )
    ).all()
    product_map = {p.id: p for p in products}
    if len(product_map) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more items are unavailable or inactive")

    subtotal = Decimal("0.00")
    order_items_to_create: list[OrderItem] = []

    for line in payload.items:
        prod = product_map[line.product_id]
        line_total = (prod.price * line.quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        subtotal += line_total
        order_items_to_create.append(
            OrderItem(
                product_id=prod.id, product_name_snapshot=prod.name,
                unit_price=prod.price, quantity=line.quantity, line_total=line_total,
            )
        )

    if payload.discount_type == "flat":
        discount_amount = payload.discount_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif payload.discount_type == "percent":
        if payload.discount_value > Decimal("100.00"):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Percentage discount cannot exceed 100%")
        discount_amount = (subtotal * payload.discount_value / Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        discount_amount = Decimal("0.00")

    if discount_amount > subtotal:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Discount cannot exceed subtotal")

    taxable_amount = subtotal - discount_amount
    tax_amount = (
        (taxable_amount * setting.tax_rate / Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if setting.tax_enabled
        else Decimal("0.00")
    )
    grand_total = (taxable_amount + tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    kot_allowed = "pos:print_kot" in (current_user.permissions or [])
    kot_printed = bool(payload.print_kot and kot_allowed)

    bill_number, bill_date, daily_sequence = generate_atomic_bill_number(db, franchise_id, setting.timezone)

    customer_id: UUID | None = None
    if payload.customer_phone:
        customer = db.scalar(
            select(Customer).where(Customer.franchise_id == franchise_id, Customer.phone == payload.customer_phone).with_for_update()
        )
        if customer is None:
            customer = Customer(
                franchise_id=franchise_id, phone=payload.customer_phone,
                name=payload.customer_name, total_orders=1, total_spent=grand_total,
            )
            db.add(customer)
            db.flush()
        else:
            if payload.customer_name:
                customer.name = payload.customer_name
            customer.total_orders += 1
            customer.total_spent = customer.total_spent + grand_total
        customer_id = customer.id

    order = Order(
        bill_number=bill_number, bill_date=bill_date, daily_sequence=daily_sequence,
        franchise_id=franchise_id, cashier_id=current_user.id, customer_id=customer_id,
        order_type=payload.order_type, payment_mode=payload.payment_mode,
        subtotal=subtotal, discount_amount=discount_amount, tax_amount=tax_amount,
        grand_total=grand_total, kot_printed=kot_printed, reprint_count=0,
        status=OrderStatus.COMPLETED,
    )
    db.add(order)
    db.flush()

    for oi in order_items_to_create:
        oi.order_id = order.id
        db.add(oi)

    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")
    db.add(ActivityLog(
        franchise_id=franchise_id, user_id=current_user.id, event_type="BILL_CREATED",
        description=f"Bill {bill_number} settled ({payload.payment_mode.value}) ₹{grand_total}",
        ip_address=client_ip, user_agent=user_agent,
    ))
    db.add(ActivityLog(
        franchise_id=franchise_id, user_id=current_user.id, event_type="RECEIPT_PRINTED",
        description=f"Receipt printed for {bill_number}" + (" + KOT" if kot_printed else ""),
        ip_address=client_ip, user_agent=user_agent,
    ))
    db.commit()
    db.refresh(order)

    return OrderReceiptResponse(
        order=OrderResponse.model_validate(order),
        cashier_name=current_user.full_name,
        is_duplicate=False,
        receipt_settings=_build_receipt_settings(order, setting),
    )


@router.get("/orders/today", response_model=TodayOrdersSummaryResponse)
def get_today_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TodayOrdersSummaryResponse:
    if current_user.franchise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Endpoint requires an outlet context")

    setting = get_effective_setting(db, current_user.franchise_id)
    today_date = datetime.now(ZoneInfo(setting.timezone or "Asia/Kolkata")).date()
    filters = [
        Order.franchise_id == current_user.franchise_id,
        Order.bill_date == today_date,
        Order.status == OrderStatus.COMPLETED,
    ]
    if current_user.role.value == "cashier" and "reports:today_sales" not in (current_user.permissions or []):
        filters.append(Order.cashier_id == current_user.id)

    orders = (
        db.scalars(
            select(Order).options(joinedload(Order.items), joinedload(Order.customer))
            .where(*filters).order_by(Order.created_at.desc())
        ).unique().all()
    )

    return TodayOrdersSummaryResponse(
        bill_date=today_date,
        total_orders=len(orders),
        total_revenue=sum((o.grand_total for o in orders), Decimal("0.00")),
        cash_total=sum((o.grand_total for o in orders if o.payment_mode == PaymentMode.CASH), Decimal("0.00")),
        upi_total=sum((o.grand_total for o in orders if o.payment_mode == PaymentMode.UPI), Decimal("0.00")),
        card_total=sum((o.grand_total for o in orders if o.payment_mode == PaymentMode.CARD), Decimal("0.00")),
        split_total=sum((o.grand_total for o in orders if o.payment_mode == PaymentMode.SPLIT), Decimal("0.00")),
        orders=[OrderResponse.model_validate(o) for o in orders],
    )


@router.post("/orders/{order_id}/reprint", response_model=OrderReceiptResponse)
def reprint_order_receipt(
    order_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pos:reprint_receipt")),
) -> OrderReceiptResponse:
    order = (
        db.scalars(
            select(Order)
            .options(
                joinedload(Order.items), joinedload(Order.customer),
                joinedload(Order.franchise), joinedload(Order.cashier),
            )
            .where(Order.id == order_id).with_for_update()
        ).unique().first()
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if current_user.franchise_id is not None and order.franchise_id != current_user.franchise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot reprint bills from another outlet")

    order.reprint_count += 1
    setting = get_effective_setting(db, order.franchise_id)

    db.add(ActivityLog(
        franchise_id=order.franchise_id, user_id=current_user.id, event_type="RECEIPT_REPRINTED",
        description=f"Reprinted bill {order.bill_number} (copy #{order.reprint_count})",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(order)

    return OrderReceiptResponse(
        order=OrderResponse.model_validate(order),
        cashier_name=order.cashier.full_name,
        is_duplicate=True,
        receipt_settings=_build_receipt_settings(order, setting),
    )
