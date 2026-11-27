"""v1.1 multi-order source and product_prices table

Revision ID: 0008_v1_1_order_sources
Revises: 0007_v1_1_recipes
Create Date: 2026-11-27 19:25:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_v1_1_order_sources"
down_revision: Union[str, None] = "0007_v1_1_recipes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE order_type ADD VALUE IF NOT EXISTS 'swiggy'")
        op.execute("ALTER TYPE order_type ADD VALUE IF NOT EXISTS 'zomato'")

    op.create_table(
        "product_prices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_source", sa.String(length=50), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "order_source", name="uq_product_prices_product_source"),
    )
    op.create_index("ix_product_prices_product_id", "product_prices", ["product_id"])
    op.create_index("ix_product_prices_order_source", "product_prices", ["order_source"])

    op.add_column(
        "orders",
        sa.Column("order_source", sa.String(length=50), server_default="dine_in", nullable=False),
    )
    op.add_column(
        "orders",
        sa.Column("external_order_number", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("customer_name_snapshot", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("table_number", sa.String(length=20), nullable=True),
    )
    op.create_index("ix_orders_order_source", "orders", ["order_source"])
    op.create_index("ix_orders_external_order_number", "orders", ["external_order_number"])

    op.execute("UPDATE orders SET order_source = order_type::text")
    op.execute(
        """
        INSERT INTO product_prices (id, product_id, order_source, price)
        SELECT gen_random_uuid(), id, 'dine_in', price FROM products
        ON CONFLICT (product_id, order_source) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO product_prices (id, product_id, order_source, price)
        SELECT gen_random_uuid(), id, 'takeaway', price FROM products
        ON CONFLICT (product_id, order_source) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_orders_external_order_number", table_name="orders")
    op.drop_index("ix_orders_order_source", table_name="orders")
    op.drop_column("orders", "table_number")
    op.drop_column("orders", "customer_name_snapshot")
    op.drop_column("orders", "external_order_number")
    op.drop_column("orders", "order_source")

    op.drop_index("ix_product_prices_order_source", table_name="product_prices")
    op.drop_index("ix_product_prices_product_id", table_name="product_prices")
    op.drop_table("product_prices")
