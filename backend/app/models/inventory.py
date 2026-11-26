import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class InventoryUnit(str, enum.Enum):
    PCS = "pcs"
    PACK = "pack"
    KG = "kg"
    LITER = "liter"
    BOX = "box"


class InventoryChangeType(str, enum.Enum):
    OPENING_STOCK = "opening_stock"
    MANUAL_ADJUST = "manual_adjust"
    REQUEST_DELIVERED = "request_delivered"
    WASTAGE = "wastage"


class InventoryItem(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "inventory_items"

    franchise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("franchises.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    unit: Mapped[InventoryUnit] = mapped_column(
        Enum(
            InventoryUnit,
            name="inventory_unit",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    current_stock: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )
    reorder_level: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )

    franchise = relationship("Franchise", lazy="joined")
    transactions = relationship(
        "InventoryTransaction",
        back_populates="inventory_item",
        lazy="select",
    )

    __table_args__ = (
        Index(
            "ix_inventory_items_franchise_active_stock",
            "franchise_id",
            "is_active",
            "current_stock",
        ),
    )


class InventoryTransaction(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "inventory_transactions"

    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    franchise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("franchises.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    performed_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    change_type: Mapped[InventoryChangeType] = mapped_column(
        Enum(
            InventoryChangeType,
            name="inventory_change_type",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    quantity_delta: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    remarks: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    inventory_item = relationship("InventoryItem", back_populates="transactions", lazy="joined")
    performed_by = relationship("User", lazy="joined")

    __table_args__ = (
        Index(
            "ix_inv_tx_franchise_item_created",
            "franchise_id",
            "inventory_item_id",
            "created_at",
        ),
    )
