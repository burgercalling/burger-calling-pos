import enum

from sqlalchemy import Enum, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class FranchiseModelType(str, enum.Enum):
    SIGNATURE_RESTAURANT = "Signature Restaurant"
    EXPRESS_KIOSK = "Express Kiosk"
    MINI_OUTLET = "Mini Outlet"


class Franchise(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "franchises"

    outlet_code: Mapped[str] = mapped_column(
        String(16),
        unique=True,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    model_type: Mapped[FranchiseModelType] = mapped_column(
        Enum(
            FranchiseModelType,
            name="franchise_model_type",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)

    users = relationship("User", back_populates="franchise", lazy="select")
    settings = relationship("Setting", back_populates="franchise", uselist=False, lazy="select")

    __table_args__ = (
        Index("ix_franchises_active_outlet_code", "is_active", "outlet_code"),
    )
