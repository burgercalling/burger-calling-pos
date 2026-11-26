from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.setting import PrinterWidthMode, Setting
from app.models.user import User, UserRole


def run_startup_bootstrap(db: Session) -> None:
    existing_superadmin = db.scalar(
        select(User.id).where(User.role == UserRole.SUPER_ADMIN).limit(1)
    )
    if existing_superadmin is None:
        super_admin = User(
            franchise_id=None,
            full_name=settings.INITIAL_SUPERADMIN_NAME,
            username=settings.INITIAL_SUPERADMIN_USERNAME.strip().lower(),
            password_hash=hash_password(settings.INITIAL_SUPERADMIN_PASSWORD),
            role=UserRole.SUPER_ADMIN,
            permissions=["*"],
            is_active=True,
        )
        db.add(super_admin)

    existing_global_settings = db.scalar(
        select(Setting.id).where(Setting.franchise_id.is_(None)).limit(1)
    )
    if existing_global_settings is None:
        global_settings = Setting(
            franchise_id=None,
            brand_name="Burger Calling",
            receipt_footer="100% Pure Veg | Thank you for visiting Burger Calling!",
            tax_enabled=False,
            tax_label="GST",
            tax_rate=Decimal("0.00"),
            gstin=None,
            currency_code="INR",
            currency_symbol="₹",
            date_format="DD/MM/YYYY",
            timezone="Asia/Kolkata",
            printer_width_mode=PrinterWidthMode.AUTO,
            default_kot_enabled=True,
        )
        db.add(global_settings)

    db.commit()
