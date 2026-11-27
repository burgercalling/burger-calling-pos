import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class StockRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PACKED = "packed"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class StockRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "stock_requests"

    request_number: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        index=True,
    )
    franchise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("franchises.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[StockRequestStatus] = mapped_column(
        Enum(
            StockRequestStatus,
            name="stock_request_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=StockRequestStatus.PENDING,
        server_default="pending",
        nullable=False,
        index=True,
    )
    inventory_applied: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    franchise = relationship("Franchise", lazy="joined")
    requested_by = relationship("User", foreign_keys=[requested_by_id], lazy="joined")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id], lazy="joined")
    items = relationship(
        "StockRequestItem",
        back_populates="stock_request",
        cascade="all, delete-orphan",
        lazy="joined",
    )

    __table_args__ = (
        Index(
            "ix_stock_requests_franchise_status_created",
            "franchise_id",
            "status",
            "created_at",
        ),
    )


class StockRequestItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "stock_request_items"

    stock_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stock_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    item_name_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    unit_snapshot: Mapped[str] = mapped_column(String(20), nullable=False)
    requested_qty: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    approved_qty: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    stock_request = relationship("StockRequest", back_populates="items")
    inventory_item = relationship("InventoryItem", lazy="select")
