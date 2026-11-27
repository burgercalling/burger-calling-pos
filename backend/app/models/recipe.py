import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ProductRecipe(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "product_recipes"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ingredient_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity_required: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="pcs")

    product = relationship("Product", back_populates="recipes")

    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "ingredient_name",
            name="uq_product_recipes_product_ingredient",
        ),
    )
