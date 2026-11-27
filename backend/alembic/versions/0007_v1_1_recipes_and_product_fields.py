"""v1.1 add product cost_price, tax_rate, product_recipes, sale_deduction enum & perf indexes

Revision ID: 0007_v1_1_recipes
Revises: 0006_category_image_url
Create Date: 2026-11-27 19:10:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_v1_1_recipes"
down_revision: Union[str, None] = "0006_category_image_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE inventory_change_type ADD VALUE IF NOT EXISTS 'sale_deduction'"
        )

    op.add_column("products", sa.Column("cost_price", sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column("products", sa.Column("tax_rate", sa.Numeric(precision=5, scale=2), nullable=True))

    op.create_table(
        "product_recipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ingredient_name", sa.String(length=150), nullable=False),
        sa.Column("quantity_required", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("unit", sa.String(length=20), server_default="pcs", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "ingredient_name", name="uq_product_recipes_product_ingredient"),
    )
    op.create_index("ix_product_recipes_product_id", "product_recipes", ["product_id"])

    op.create_index("ix_orders_created_at_status", "orders", ["created_at", "status"])
    op.create_index("ix_order_items_order_product", "order_items", ["order_id", "product_id"])


def downgrade() -> None:
    op.drop_index("ix_order_items_order_product", table_name="order_items")
    op.drop_index("ix_orders_created_at_status", table_name="orders")
    op.drop_index("ix_product_recipes_product_id", table_name="product_recipes")
    op.drop_table("product_recipes")
    op.drop_column("products", "tax_rate")
    op.drop_column("products", "cost_price")
