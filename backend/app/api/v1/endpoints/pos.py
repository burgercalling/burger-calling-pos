from collections import defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.customer import Customer
from app.models.inventory import InventoryChangeType, InventoryItem, InventoryTransaction
from app.models.order import Order, OrderItem, OrderStatus, OrderType, PaymentMode
from app.models.product import Product
from app.models.setting import Setting
from app.models.user import User, UserRole
from app.schemas.pos import (
    CreateOrderRequest,
    OrderReceiptResponse,
    OrderResponse,
    ReceiptSettingsPayload,
    TodayOrdersSummaryResponse,
)
from app.services.audit import get_client_ip, record_audit_log
from app.services.billing import generate_atomic_bill_number, get_effective_setting

router = APIRouter(prefix="/pos", tags=["POS Billing"])


def _resolve_channel_price(product: Product, order_source: str) -> Decimal:
    src = (order_source or "dine_in").strip().lower()
    for pp in product.prices or []:
        if pp.order_source.strip().lower() == src:
            return pp.price
    return product.price


def _convert_recipe_qty(qty: Decimal, recipe_unit: str, inv_unit: str) -> Decimal:
    ru = (recipe_unit or "").strip().lower()
    iu = (inv_unit or "").strip().lower()
    if ru == iu:
        return qty
    if ru == "g" and iu == "kg":
        return qty / Decimal("1000")
    if ru == "kg" and iu == "g":
        return qty * Decimal("1000")
    if ru == "ml" and iu == "liter":
        return qty / Decimal("1000")
    if ru == "liter" and iu == "ml":
        return qty * Decimal("1000")
    return qty


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

    effective_source = (payload.order_source or payload.order_type.value).strip().lower()
    try:
        resolved_order_type = OrderType(effective_source)
    except ValueError:
        resolved_order_type = payload.order_type

    product_ids = [line.product_id for line in payload.items]
    products = db.scalars(
        select(Product)
        .options(selectinload(Product.recipes), selectinload(Product.prices))
        .where(
            Product.id.in_(product_ids),
            Product.is_active.is_(True),
            Product.is_available.is_(True),
            Product.deleted_at.is_(None),
        )
    ).all()
    product_map = {p.id: p for p in products}
    if len(product_map) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more items are unavailable or inactive")

    subtotal = Decimal("0.00")
    order_items_to_create: list[OrderItem] = []
    ingredient_needs: dict[str, list[tuple[Decimal, str]]] = defaultdict(list)

    for line in payload.items:
        prod = product_map[line.product_id]
        unit_price = _resolve_channel_price(prod, effective_source)
        line_total = (unit_price * line.quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        subtotal += line_total
        order_items_to_create.append(
            OrderItem(
                product_id=prod.id,
                product_name_snapshot=prod.name,
                unit_price=unit_price,
                quantity=line.quantity,
                line_total=line_total,
            )
        )
        for rec in prod.recipes or []:
            key = rec.ingredient_name.strip().lower()
            needed = rec.quantity_required * Decimal(line.quantity)
            ingredient_needs[key].append((needed, rec.unit))

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
        bill_number=bill_number,
        bill_date=bill_date,
        daily_sequence=daily_sequence,
        franchise_id=franchise_id,
        cashier_id=current_user.id,
        customer_id=customer_id,
        order_type=resolved_order_type,
        order_source=effective_source,
        external_order_number=payload.external_order_number,
        customer_name_snapshot=payload.customer_name,
        table_number=payload.table_number,
        payment_mode=payload.payment_mode,
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        grand_total=grand_total,
        kot_printed=kot_printed,
        reprint_count=0,
        status=OrderStatus.COMPLETED,
    )
    db.add(order)
    db.flush()

    for oi in order_items_to_create:
        oi.order_id = order.id
        db.add(oi)

    # Automatic Recipe / BOM Inventory Deduction
    if ingredient_needs:
        outlet_inv_items = db.scalars(
            select(InventoryItem)
            .where(
                InventoryItem.franchise_id == franchise_id,
                InventoryItem.is_active.is_(True),
                InventoryItem.deleted_at.is_(None),
            )
            .order_by(InventoryItem.id.asc())
            .with_for_update(of=InventoryItem)
        ).all()
        inv_by_name = {item.item_name.strip().lower(): item for item in outlet_inv_items}

        for ing_key, usages in ingredient_needs.items():
            inv_item = inv_by_name.get(ing_key)
            if inv_item is None:
                continue
            total_deduct = sum(
                (_convert_recipe_qty(q, u, inv_item.unit.value) for q, u in usages),
                Decimal("0.000"),
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            if total_deduct <= Decimal("0.00"):
                continue

            prev_stock = inv_item.current_stock
            new_balance = max(Decimal("0.00"), prev_stock - total_deduct)
            actual_delta = new_balance - prev_stock
            inv_item.current_stock = new_balance

            db.add(
                InventoryTransaction(
                    inventory_item_id=inv_item.id,
                    franchise_id=franchise_id,
                    performed_by_id=current_user.id,
                    change_type=InventoryChangeType.SALE_DEDUCTION,
                    quantity_delta=actual_delta,
                    previous_stock=prev_stock,
                    balance_after=new_balance,
                    reference_type="order",
                    reference_id=str(order.id),
                    remarks=f"Auto-deducted for Bill {bill_number} (BOM recipe)",
                )
            )

    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")
    ext_note = f" [{payload.external_order_number}]" if payload.external_order_number else ""
    db.add(ActivityLog(
        franchise_id=franchise_id, user_id=current_user.id, event_type="BILL_CREATED",
        description=f"Bill {bill_number} ({effective_source.upper()}{ext_note}) settled ({payload.payment_mode.value}) ₹{grand_total}",
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


@router.post("/orders/{order_id}/void", response_model=OrderResponse)
def void_pos_order(
    order_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderResponse:
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.FRANCHISE_OWNER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admin or Franchise Owner can void orders")

    order = (
        db.scalars(
            select(Order)
            .options(joinedload(Order.items), joinedload(Order.customer))
            .where(Order.id == order_id)
            .with_for_update(of=Order)
        )
        .unique()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if current_user.role == UserRole.FRANCHISE_OWNER and order.franchise_id != current_user.franchise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot void bills from another outlet")

    if order.status == OrderStatus.VOIDED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is already voided")

    order.status = OrderStatus.VOIDED

    # Restore BOM-deducted inventory atomically (preventing duplicate restoration)
    already_restored = db.scalar(
        select(InventoryTransaction.id).where(
            InventoryTransaction.reference_type == "order_void",
            InventoryTransaction.reference_id == str(order.id),
        )
    )
    if already_restored is None:
        deductions = db.scalars(
            select(InventoryTransaction).where(
                InventoryTransaction.reference_type == "order",
                InventoryTransaction.reference_id == str(order.id),
                InventoryTransaction.change_type == InventoryChangeType.SALE_DEDUCTION,
            )
        ).all()
        if deductions:
            inv_ids = sorted({d.inventory_item_id for d in deductions})
            locked_items = db.scalars(
                select(InventoryItem)
                .where(InventoryItem.id.in_(inv_ids))
                .order_by(InventoryItem.id.asc())
                .with_for_update(of=InventoryItem)
            ).all()
            inv_map = {item.id: item for item in locked_items}
            for tx in deductions:
                restore_qty = abs(tx.quantity_delta)
                if restore_qty <= Decimal("0.00"):
                    continue
                inv_item = inv_map.get(tx.inventory_item_id)
                if inv_item is None:
                    continue
                prev_stock = inv_item.current_stock
                new_stock = prev_stock + restore_qty
                inv_item.current_stock = new_stock
                db.add(
                    InventoryTransaction(
                        inventory_item_id=inv_item.id,
                        franchise_id=order.franchise_id,
                        performed_by_id=current_user.id,
                        change_type=InventoryChangeType.RETURN,
                        quantity_delta=restore_qty,
                        previous_stock=prev_stock,
                        balance_after=new_stock,
                        reference_type="order_void",
                        reference_id=str(order.id),
                        remarks=f"Stock restored for voided Bill {order.bill_number}",
                    )
                )

    client_ip = get_client_ip(request)
    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=order.franchise_id,
        action="VOID_ORDER",
        entity_type="order",
        entity_id=order.id,
        old_values={"status": OrderStatus.COMPLETED.value},
        new_values={"status": OrderStatus.VOIDED.value},
        ip_address=client_ip,
    )
    db.add(
        ActivityLog(
            franchise_id=order.franchise_id,
            user_id=current_user.id,
            event_type="BILL_VOIDED",
            description=f"Voided Bill {order.bill_number} and restored BOM stock",
            ip_address=client_ip,
            user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)


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
            .where(Order.id == order_id).with_for_update(of=Order)
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
