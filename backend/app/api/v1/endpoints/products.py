import csv
import io
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.category import Category
from app.models.product import Product, ProductItemType
from app.models.product_price import ProductPrice
from app.models.user import User, UserRole
from app.schemas.menu import (
    BulkImportCommitRequest,
    BulkImportCommitResponse,
    BulkImportPreviewResponse,
    BulkImportRow,
    PaginatedProductsResponse,
    ProductAvailabilityUpdate,
    ProductCreate,
    ProductPriceInput,
    ProductResponse,
    ProductUpdate,
    ZomatoImportRequest,
)
from app.services.audit import get_client_ip, record_audit_log
from app.storage.upload_service import LocalStorageService, get_upload_service

router = APIRouter(prefix="/products", tags=["Products"])


def _upsert_product_prices(db: Session, product: Product, prices: list[ProductPriceInput] | None) -> None:
    existing_map = {pp.order_source: pp for pp in (product.prices or [])}
    if prices is not None:
        for entry in prices:
            src = entry.order_source.strip().lower()
            if src in existing_map:
                existing_map[src].price = entry.price
            else:
                pp = ProductPrice(product_id=product.id, order_source=src, price=entry.price)
                db.add(pp)
                existing_map[src] = pp
    # Guarantee default dine_in and takeaway fallback rows if missing
    for default_src in ("dine_in", "takeaway"):
        if default_src not in existing_map:
            db.add(ProductPrice(product_id=product.id, order_source=default_src, price=product.price))


def _product_snapshot(p: Product) -> dict:
    return {
        "category_id": str(p.category_id),
        "sku": p.sku,
        "name": p.name,
        "description": p.description,
        "price": str(p.price),
        "cost_price": str(p.cost_price) if p.cost_price is not None else None,
        "tax_rate": str(p.tax_rate) if p.tax_rate is not None else None,
        "image_url": p.image_url,
        "item_type": p.item_type.value,
        "is_available": p.is_available,
        "is_active": p.is_active,
        "deleted_at": p.deleted_at.isoformat() if p.deleted_at else None,
    }


def _parse_bool(val: object, default: bool = True) -> bool:
    if val is None or str(val).strip() == "":
        return default
    s = str(val).strip().lower()
    if s in ("true", "1", "yes", "y", "available", "active"):
        return True
    if s in ("false", "0", "no", "n", "unavailable", "inactive"):
        return False
    return default


def _parse_decimal(val: object) -> Decimal | None:
    if val is None:
        return None
    s = str(val).strip().replace("₹", "").replace(",", "").replace("%", "")
    if not s:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _normalize_header(h: object) -> str:
    return str(h or "").strip().lower().replace("_", " ").replace("-", " ")


def _extract_tabular_rows(filename: str, raw_bytes: bytes) -> list[dict[str, str]]:
    lower_name = filename.lower()
    records: list[dict[str, str]] = []

    if lower_name.endswith(".csv"):
        text = raw_bytes.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            cleaned = {_normalize_header(k): (v or "").strip() for k, v in row.items() if k is not None}
            if any(cleaned.values()):
                records.append(cleaned)
        return records

    if lower_name.endswith(".xlsx") or lower_name.endswith(".xlsm"):
        wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
        headers_raw = next(rows_iter, None)
        if not headers_raw:
            return []
        headers = [_normalize_header(h) for h in headers_raw]
        for row_vals in rows_iter:
            row_dict: dict[str, str] = {}
            for idx, h in enumerate(headers):
                if not h:
                    continue
                val = row_vals[idx] if idx < len(row_vals) else None
                row_dict[h] = str(val).strip() if val is not None else ""
            if any(row_dict.values()):
                records.append(row_dict)
        wb.close()
        return records

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file type. Please upload a .csv or .xlsx file.",
    )


def _pick_field(row: dict[str, str], candidates: tuple[str, ...]) -> str:
    for c in candidates:
        if c in row and row[c] != "":
            return row[c]
    return ""


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
        cost_price=payload.cost_price,
        tax_rate=payload.tax_rate,
        image_url=payload.image_url,
        item_type=payload.item_type,
        is_available=payload.is_available,
        is_active=True,
    )
    db.add(product)
    db.flush()
    _upsert_product_prices(db, product, payload.prices)

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
    product = db.scalar(
        select(Product)
        .options(joinedload(Product.category), selectinload(Product.recipes), selectinload(Product.prices))
        .where(Product.id == product.id)
    )
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
        select(Product)
        .options(joinedload(Product.category), selectinload(Product.recipes), selectinload(Product.prices))
        .where(*filters)
        .order_by(Product.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return PaginatedProductsResponse(
        items=[ProductResponse.model_validate(item) for item in items],
        total=total, page=page, page_size=page_size,
    )


@router.post("/bulk-import/preview", response_model=BulkImportPreviewResponse)
async def preview_bulk_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> BulkImportPreviewResponse:
    raw_bytes = await file.read()
    if len(raw_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds 5MB limit")

    records = _extract_tabular_rows(file.filename or "upload.csv", raw_bytes)
    if not records:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file contains no data rows")

    existing_products = db.scalars(select(Product).where(Product.deleted_at.is_(None))).all()
    sku_map = {p.sku.upper(): p for p in existing_products if p.sku}
    name_map = {p.name.strip().lower(): p for p in existing_products}

    preview_rows: list[BulkImportRow] = []
    seen_skus: set[str] = set()
    seen_names: set[str] = set()
    valid_creates = 0
    valid_updates = 0
    skipped = 0
    errors = 0

    for idx, rec in enumerate(records, start=2):
        category = _pick_field(rec, ("category", "category name"))
        name = _pick_field(rec, ("product name", "name", "item name", "title"))
        description = _pick_field(rec, ("description", "desc", "details")) or None
        price_raw = _pick_field(rec, ("price", "selling price", "mrp", "current price"))
        dine_in_raw = _pick_field(rec, ("dine in price", "dine in", "dinein price"))
        takeaway_raw = _pick_field(rec, ("take away price", "takeaway price", "take away", "takeaway"))
        swiggy_raw = _pick_field(rec, ("swiggy price", "swiggy"))
        zomato_raw = _pick_field(rec, ("zomato price", "zomato"))
        cost_raw = _pick_field(rec, ("cost price", "cost", "purchase price"))
        image_url = _pick_field(rec, ("image url", "image", "photo url")) or None
        avail_raw = _pick_field(rec, ("available", "is available", "status"))
        sku_raw = _pick_field(rec, ("sku", "code", "item code", "catalogue id")).upper() or None
        tax_raw = _pick_field(rec, ("tax", "tax rate", "gst", "taxes"))
        type_raw = _pick_field(rec, ("item type", "type")).lower()

        dine_in_price = _parse_decimal(dine_in_raw)
        takeaway_price = _parse_decimal(takeaway_raw)
        swiggy_price = _parse_decimal(swiggy_raw)
        zomato_price = _parse_decimal(zomato_raw)
        price = _parse_decimal(price_raw) or dine_in_price or takeaway_price or swiggy_price or zomato_price
        cost_price = _parse_decimal(cost_raw)
        tax_rate = _parse_decimal(tax_raw)
        is_available = _parse_bool(avail_raw, default=True)
        item_type = ProductItemType.COMBO if type_raw == "combo" else ProductItemType.REGULAR

        row_error: str | None = None
        if not category:
            row_error = "Missing Category"
        elif not name or len(name) < 2:
            row_error = "Missing or invalid Product Name"
        elif price is None or price <= Decimal("0.00"):
            row_error = "Invalid or missing Price / Dine In Price (> 0 required)"
        elif cost_price is not None and cost_price < Decimal("0.00"):
            row_error = "Cost Price cannot be negative"
        elif tax_rate is not None and (tax_rate < Decimal("0.00") or tax_rate > Decimal("100.00")):
            row_error = "Tax rate must be between 0 and 100"

        name_key = name.strip().lower() if name else ""
        if row_error is None:
            if sku_raw and sku_raw in seen_skus:
                row_error = f"Duplicate SKU '{sku_raw}' in file"
            elif name_key and name_key in seen_names:
                row_error = f"Duplicate Product Name '{name}' in file"

        if sku_raw:
            seen_skus.add(sku_raw)
        if name_key:
            seen_names.add(name_key)

        if row_error:
            errors += 1
            row_status = "error"
        elif (sku_raw and sku_raw in sku_map) or (name_key in name_map):
            valid_updates += 1
            row_status = "update"
        else:
            valid_creates += 1
            row_status = "create"

        preview_rows.append(
            BulkImportRow(
                row_number=idx,
                category=category,
                name=name,
                description=description,
                price=price,
                dine_in_price=dine_in_price or price,
                takeaway_price=takeaway_price or dine_in_price or price,
                swiggy_price=swiggy_price,
                zomato_price=zomato_price,
                cost_price=cost_price,
                image_url=image_url,
                is_available=is_available,
                sku=sku_raw,
                tax_rate=tax_rate,
                item_type=item_type,
                status=row_status,
                error=row_error,
            )
        )

    return BulkImportPreviewResponse(
        total_rows=len(preview_rows),
        valid_creates=valid_creates,
        valid_updates=valid_updates,
        skipped=skipped,
        errors=errors,
        rows=preview_rows,
    )


async def _resolve_local_image(
    raw_url: str | None,
    storage: LocalStorageService,
) -> tuple[str | None, str | None]:
    if not raw_url:
        return None, None
    trimmed = raw_url.strip()
    if not trimmed:
        return None, None
    if trimmed.startswith("/uploads/"):
        return trimmed, None
    if trimmed.startswith(("http://", "https://")):
        try:
            res = await storage.save_image_from_url(trimmed, "products")
            return res.relative_path, None
        except HTTPException as exc:
            return None, f"Image download skipped ({exc.detail})"
    return None, "Invalid image URL format"


@router.post("/bulk-import/commit", response_model=BulkImportCommitResponse)
async def commit_bulk_import(
    payload: BulkImportCommitRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> BulkImportCommitResponse:
    categories = db.scalars(select(Category).where(Category.deleted_at.is_(None))).all()
    cat_map = {c.name.strip().lower(): c for c in categories}
    max_order = max((c.display_order for c in categories), default=0)

    existing_products = db.scalars(
        select(Product).options(selectinload(Product.prices)).where(Product.deleted_at.is_(None))
    ).all()
    sku_map = {p.sku.upper(): p for p in existing_products if p.sku}
    name_map = {p.name.strip().lower(): p for p in existing_products}

    imported = 0
    updated = 0
    failed = 0
    skipped = 0
    errors: list[str] = []

    for row in payload.rows:
        base_price = row.dine_in_price or row.price
        if row.status == "error" or not row.name or not row.category or not base_price or base_price <= Decimal("0.00"):
            failed += 1
            errors.append(f"Row {row.row_number}: {row.error or 'Invalid row data'}")
            continue

        cat_key = row.category.strip().lower()
        category = cat_map.get(cat_key)
        if category is None:
            max_order += 10
            category = Category(name=row.category.strip(), display_order=max_order, is_active=True)
            db.add(category)
            db.flush()
            cat_map[cat_key] = category

        local_img, img_warn = await _resolve_local_image(row.image_url, storage)
        if img_warn:
            errors.append(f"Row {row.row_number} ({row.name}): {img_warn}")

        channel_prices: list[ProductPriceInput] = [
            ProductPriceInput(order_source="dine_in", price=row.dine_in_price or base_price),
            ProductPriceInput(order_source="takeaway", price=row.takeaway_price or base_price),
        ]
        if row.swiggy_price and row.swiggy_price > Decimal("0.00"):
            channel_prices.append(ProductPriceInput(order_source="swiggy", price=row.swiggy_price))
        if row.zomato_price and row.zomato_price > Decimal("0.00"):
            channel_prices.append(ProductPriceInput(order_source="zomato", price=row.zomato_price))

        sku_norm = row.sku.strip().upper() if row.sku else None
        name_key = row.name.strip().lower()
        existing = (sku_map.get(sku_norm) if sku_norm else None) or name_map.get(name_key)

        if existing is not None:
            if not payload.update_existing:
                skipped += 1
                continue
            existing.category_id = category.id
            existing.name = row.name.strip()
            existing.description = row.description
            existing.price = base_price
            existing.cost_price = row.cost_price
            existing.tax_rate = row.tax_rate
            existing.is_available = row.is_available
            existing.item_type = row.item_type
            if sku_norm and sku_norm != existing.sku and sku_norm not in sku_map:
                existing.sku = sku_norm
                sku_map[sku_norm] = existing
            if local_img:
                existing.image_url = local_img
            _upsert_product_prices(db, existing, channel_prices)
            updated += 1
        else:
            new_prod = Product(
                category_id=category.id,
                sku=sku_norm,
                name=row.name.strip(),
                description=row.description,
                price=base_price,
                cost_price=row.cost_price,
                tax_rate=row.tax_rate,
                image_url=local_img,
                item_type=row.item_type,
                is_available=row.is_available,
                is_active=True,
            )
            db.add(new_prod)
            db.flush()
            _upsert_product_prices(db, new_prod, channel_prices)
            if sku_norm:
                sku_map[sku_norm] = new_prod
            name_map[name_key] = new_prod
            imported += 1

    db.add(
        ActivityLog(
            franchise_id=None,
            user_id=current_user.id,
            event_type="PRODUCTS_BULK_IMPORTED",
            description=f"Bulk import completed: {imported} imported, {updated} updated, {skipped} skipped, {failed} failed",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()

    return BulkImportCommitResponse(
        imported=imported,
        updated=updated,
        failed=failed,
        skipped=skipped,
        errors=errors[:30],
    )


@router.post("/zomato-import", response_model=BulkImportCommitResponse)
async def zomato_menu_import(
    payload: ZomatoImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> BulkImportCommitResponse:
    if not payload.rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No Zomato menu rows provided")

    categories = db.scalars(select(Category).where(Category.deleted_at.is_(None))).all()
    cat_map = {c.name.strip().lower(): c for c in categories}
    max_order = max((c.display_order for c in categories), default=0)

    existing_products = db.scalars(
        select(Product).options(selectinload(Product.prices)).where(Product.deleted_at.is_(None))
    ).all()
    sku_map = {p.sku.upper(): p for p in existing_products if p.sku}
    name_map = {p.name.strip().lower(): p for p in existing_products}

    imported = 0
    updated = 0
    failed = 0
    skipped = 0
    errors: list[str] = []

    for idx, row in enumerate(payload.rows, start=1):
        cat_key = row.category.strip().lower()
        category = cat_map.get(cat_key)
        if category is None:
            max_order += 10
            category = Category(name=row.category.strip(), display_order=max_order, is_active=True)
            db.add(category)
            db.flush()
            cat_map[cat_key] = category

        local_img, img_warn = await _resolve_local_image(row.image_url, storage)
        if img_warn:
            errors.append(f"Item #{idx} ({row.name}): {img_warn}")

        zomato_prices = [ProductPriceInput(order_source="zomato", price=row.price)]
        sku_norm = row.sku.strip().upper() if row.sku else None
        name_key = row.name.strip().lower()
        existing = (sku_map.get(sku_norm) if sku_norm else None) or name_map.get(name_key)

        if existing is not None:
            if not payload.update_existing:
                skipped += 1
                continue
            existing.category_id = category.id
            existing.description = row.description
            existing.price = row.price
            existing.cost_price = row.cost_price
            existing.tax_rate = row.tax_rate
            existing.is_available = row.is_available
            existing.item_type = row.item_type
            if local_img:
                existing.image_url = local_img
            _upsert_product_prices(db, existing, zomato_prices)
            updated += 1
        else:
            new_prod = Product(
                category_id=category.id,
                sku=sku_norm,
                name=row.name.strip(),
                description=row.description,
                price=row.price,
                cost_price=row.cost_price,
                tax_rate=row.tax_rate,
                image_url=local_img,
                item_type=row.item_type,
                is_available=row.is_available,
                is_active=True,
            )
            db.add(new_prod)
            db.flush()
            _upsert_product_prices(db, new_prod, zomato_prices)
            if sku_norm:
                sku_map[sku_norm] = new_prod
            name_map[name_key] = new_prod
            imported += 1

    db.add(
        ActivityLog(
            franchise_id=None,
            user_id=current_user.id,
            event_type="ZOMATO_MENU_IMPORTED",
            description=f"Zomato menu import: {imported} imported, {updated} updated, {skipped} skipped",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()

    return BulkImportCommitResponse(
        imported=imported,
        updated=updated,
        failed=failed,
        skipped=skipped,
        errors=errors[:30],
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
        select(Product)
        .options(joinedload(Product.category), selectinload(Product.recipes), selectinload(Product.prices))
        .where(Product.id == product_id, Product.deleted_at.is_(None))
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
    update_data = payload.model_dump(exclude_unset=True, exclude={"prices"})

    for field, value in update_data.items():
        setattr(product, field, value)

    if payload.prices is not None:
        _upsert_product_prices(db, product, payload.prices)

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
    product = db.scalar(
        select(Product)
        .options(joinedload(Product.category), selectinload(Product.recipes), selectinload(Product.prices))
        .where(Product.id == product_id)
    )
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
        select(Product)
        .options(joinedload(Product.category), selectinload(Product.recipes), selectinload(Product.prices))
        .where(Product.id == product_id, Product.deleted_at.is_(None))
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
        select(Product)
        .options(joinedload(Product.category), selectinload(Product.recipes), selectinload(Product.prices))
        .where(Product.id == product_id, Product.deleted_at.is_(None))
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
