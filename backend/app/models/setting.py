import enum
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PrinterWidthMode(str, enum.Enum):
    AUTO = "auto"
    MM_80 = "80mm"
    MM_58 = "58mm"


class Setting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "settings"

    franchise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("franchises.id", ondelete="RESTRICT"),
        unique=True,
        nullable=True,
        index=True,
    )
    brand_name: Mapped[str] = mapped_column(
        String(150),
        default="Burger Calling",
        server_default="Burger Calling",
        nullable=False,
    )
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_footer: Mapped[str] = mapped_column(
        Text,
        default="100% Pure Veg | Thank you for visiting Burger Calling!",
        server_default="100% Pure Veg | Thank you for visiting Burger Calling!",
        nullable=False,
    )
    tax_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )
    tax_label: Mapped[str] = mapped_column(
        String(50),
        default="GST",
        server_default="GST",
        nullable=False,
    )
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    currency_code: Mapped[str] = mapped_column(
        String(10),
        default="INR",
        server_default="INR",
        nullable=False,
    )
    currency_symbol: Mapped[str] = mapped_column(
        String(10),
        default="₹",
        server_default="₹",
        nullable=False,
    )
    date_format: Mapped[str] = mapped_column(
        String(20),
        default="DD/MM/YYYY",
        server_default="DD/MM/YYYY",
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(64),
        default="Asia/Kolkata",
        server_default="Asia/Kolkata",
        nullable=False,
    )
    printer_width_mode: Mapped[PrinterWidthMode] = mapped_column(
        Enum(
            PrinterWidthMode,
            name="printer_width_mode",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=PrinterWidthMode.AUTO,
        server_default="auto",
        nullable=False,
    )
    default_kot_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    franchise = relationship("Franchise", back_populates="settings", lazy="select")
