"""add customers, orders, and order_items tables

Revision ID: 0005_customers_and_orders
Revises: 0004_stock_requests
Create Date: 2026-11-23 19:34:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_customers_and_orders"
down_revision: Union[str, None] = "0004_stock_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    order_type_enum = postgresql.ENUM("dine_in", "takeaway", name="order_type", create_type=False)
    order_type_enum.create(op.get_bind(), checkfirst=True)

    payment_mode_enum = postgresql.ENUM("cash", "upi", "card", "split", name="payment_mode", create_type=False)
    payment_mode_enum.create(op.get_bind(), checkfirst=True)

    order_status_enum = postgresql.ENUM("completed", "voided", name="order_status", create_type=False)
    order_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("total_orders", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_spent", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("franchise_id", "phone", name="uq_customers_franchise_phone"),
    )
    op.create_index("ix_customers_franchise_id", "customers", ["franchise_id"])
    op.create_index("ix_customers_phone", "customers", ["phone"])

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bill_number", sa.String(length=40), nullable=False),
        sa.Column("bill_date", sa.Date(), nullable=False),
        sa.Column("daily_sequence", sa.Integer(), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cashier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("order_type", order_type_enum, nullable=False),
        sa.Column("payment_mode", payment_mode_enum, nullable=False),
        sa.Column("subtotal", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(precision=10, scale=2), server_default="0.00", nullable=False),
        sa.Column("tax_amount", sa.Numeric(precision=10, scale=2), server_default="0.00", nullable=False),
        sa.Column("grand_total", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("kot_printed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("reprint_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", order_status_enum, server_default="completed", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cashier_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("franchise_id", "bill_date", "daily_sequence", name="uq_orders_franchise_date_seq"),
    )
    op.create_index("ix_orders_bill_number", "orders", ["bill_number"], unique=True)
    op.create_index("ix_orders_bill_date", "orders", ["bill_date"])
    op.create_index("ix_orders_franchise_id", "orders", ["franchise_id"])
    op.create_index("ix_orders_cashier_id", "orders", ["cashier_id"])
    op.create_index("ix_orders_customer_id", "orders", ["customer_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_franchise_date_status", "orders", ["franchise_id", "bill_date", "status"])

    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_name_snapshot", sa.String(length=150), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("line_total", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_index("ix_order_items_product_id", "order_items", ["product_id"])


def downgrade() -> None:
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("customers")
