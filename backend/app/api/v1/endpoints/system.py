import enum
import hashlib
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.category import Category
from app.models.customer import Customer
from app.models.franchise import Franchise
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.setting import Setting
from app.models.stock_request import StockRequest, StockRequestItem
from app.models.user import User, UserRole
from app.schemas.system import RestoreResultResponse
from app.services.audit import get_client_ip, record_audit_log

router = APIRouter(prefix="/system", tags=["System Backup & Restore"])
BACKUP_SCHEMA_VERSION = "1.0.0"
IST = ZoneInfo("Asia/Kolkata")

BACKUP_TABLES: list[tuple[str, Any]] = [
    ("franchises", Franchise),
    ("users", User),
    ("settings", Setting),
    ("categories", Category),
    ("products", Product),
    ("customers", Customer),
    ("inventory_items", InventoryItem),
    ("inventory_transactions", InventoryTransaction),
    ("stock_requests", StockRequest),
    ("stock_request_items", StockRequestItem),
    ("orders", Order),
    ("order_items", OrderItem),
]


def _serialize_value(val: Any) -> Any:
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, enum.Enum):
        return val.value
    return val


def _row_to_dict(model_cls: Any, row: Any) -> dict[str, Any]:
    return {col.name: _serialize_value(getattr(row, col.name)) for col in model_cls.__table__.columns}


def _compute_checksum(data: dict[str, list[dict[str, Any]]]) -> str:
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _coerce_column_value(col: Any, val: Any) -> Any:
    if val is None:
        return None
    type_name = col.type.__class__.__name__.lower()
    if "uuid" in type_name:
        return UUID(str(val))
    if "datetime" in type_name:
        return datetime.fromisoformat(str(val))
    if type_name == "date":
        return date.fromisoformat(str(val))
    if "numeric" in type_name:
        return Decimal(str(val))
    return val


@router.get("/backup")
def export_database_backup(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> Response:
    data: dict[str, list[dict[str, Any]]] = {}
    table_counts: dict[str, int] = {}

    for table_name, model_cls in BACKUP_TABLES:
        rows = db.scalars(select(model_cls)).all()
        serialized = [_row_to_dict(model_cls, r) for r in rows]
        data[table_name] = serialized
        table_counts[table_name] = len(serialized)

    checksum = _compute_checksum(data)
    now_ist = datetime.now(IST)
    snapshot = {
        "schema_version": BACKUP_SCHEMA_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "checksum": checksum,
        "table_counts": table_counts,
        "data": data,
    }

    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="DATABASE_BACKUP_EXPORTED",
        description=f"Exported full JSON snapshot ({sum(table_counts.values())} rows)",
        ip_address=get_client_ip(request), user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()

    filename = f"burger-calling-pos-backup-{now_ist.strftime('%Y%m%d-%H%M')}.json"
    return Response(
        content=json.dumps(snapshot, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore", response_model=RestoreResultResponse)
async def restore_database_backup(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> RestoreResultResponse:
    raw = await file.read()
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON backup file: {exc}") from exc

    if payload.get("schema_version") != BACKUP_SCHEMA_VERSION:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported schema_version: {payload.get('schema_version')}")

    data = payload.get("data")
    expected_checksum = payload.get("checksum")
    if not isinstance(data, dict) or not expected_checksum:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Backup file is missing data or checksum")

    required_keys = {name for name, _ in BACKUP_TABLES}
    if not required_keys.issubset(data.keys()):
        missing = sorted(required_keys - set(data.keys()))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing tables: {', '.join(missing)}")

    if _compute_checksum(data) != expected_checksum:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Backup integrity checksum mismatch. Restore aborted.")

    restored_counts: dict[str, int] = {}
    try:
        for _, model_cls in reversed(BACKUP_TABLES):
            db.execute(delete(model_cls))

        for table_name, model_cls in BACKUP_TABLES:
            rows = data[table_name]
            restored_counts[table_name] = len(rows)
            if not rows:
                continue
            columns = {col.name: col for col in model_cls.__table__.columns}
            prepared_rows = [
                {col_name: _coerce_column_value(columns[col_name], value) for col_name, value in row.items() if col_name in columns}
                for row in rows
            ]
            db.execute(insert(model_cls), prepared_rows)

        client_ip = get_client_ip(request)
        record_audit_log(
            db, actor_user_id=current_user.id, franchise_id=None, action="DATABASE_RESTORE",
            entity_type="system", entity_id=BACKUP_SCHEMA_VERSION, old_values=None,
            new_values={"restored_counts": restored_counts, "checksum": expected_checksum}, ip_address=client_ip,
        )
        db.add(ActivityLog(
            franchise_id=None, user_id=current_user.id, event_type="DATABASE_RESTORE",
            description=f"Restored database snapshot ({sum(restored_counts.values())} rows)",
            ip_address=client_ip, user_agent=request.headers.get("User-Agent"),
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Restore failed and rolled back: {exc}") from exc

    return RestoreResultResponse(
        message="Database backup restored successfully",
        schema_version=BACKUP_SCHEMA_VERSION,
        restored_counts=restored_counts,
    )
