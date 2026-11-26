from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.franchise import Franchise
from app.models.order import Order
from app.models.setting import Setting


def get_effective_setting(db: Session, franchise_id: UUID) -> Setting:
    outlet_setting = db.scalar(
        select(Setting).where(Setting.franchise_id == franchise_id).limit(1)
    )
    if outlet_setting is not None:
        return outlet_setting

    global_setting = db.scalar(
        select(Setting).where(Setting.franchise_id.is_(None)).limit(1)
    )
    if global_setting is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Global POS settings are not initialized",
        )
    return global_setting


def generate_atomic_bill_number(
    db: Session,
    franchise_id: UUID,
    timezone_name: str,
) -> tuple[str, date, int]:
    franchise = db.scalar(
        select(Franchise)
        .where(
            Franchise.id == franchise_id,
            Franchise.is_active.is_(True),
            Franchise.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if franchise is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Outlet is inactive or unavailable",
        )

    tz = ZoneInfo(timezone_name or "Asia/Kolkata")
    bill_date = datetime.now(tz).date()

    current_max_seq = (
        db.scalar(
            select(func.coalesce(func.max(Order.daily_sequence), 0)).where(
                Order.franchise_id == franchise_id,
                Order.bill_date == bill_date,
            )
        )
        or 0
    )
    next_seq = int(current_max_seq) + 1
    bill_number = f"{bill_date.strftime('%d%m%y')}-{franchise.outlet_code}-{next_seq:04d}"
    return bill_number, bill_date, next_seq
