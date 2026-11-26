import enum
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ProductItemType(str, enum.Enum):
    REGULAR = "regular"
    COMBO = "combo"
    ADDON = "addon"


class Product(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "products"

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sku: Mapped[str | None] = mapped_column(
        String(64),
        unique=True,
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    item_type: Mapped[ProductItemType] = mapped_column(
        Enum(
            ProductItemType,
            name="product_item_type",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=ProductItemType.REGULAR,
        server_default="regular",
        nullable=False,
        index=True,
    )
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
        index=True,
    )

    category = relationship("Category", back_populates="products", lazy="joined")

    __table_args__ = (
        Index("ix_products_category_type_active", "category_id", "item_type", "is_active"),
        Index("ix_products_available_active", "is_available", "is_active"),
    )
