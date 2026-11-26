"""add inventory_items and inventory_transactions tables

Revision ID: 0003_inventory_and_transactions
Revises: 0002_categories_and_products
Create Date: 2026-11-23 19:28:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_inventory_and_transactions"
down_revision: Union[str, None] = "0002_categories_and_products"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    unit_enum = postgresql.ENUM("pcs", "pack", "kg", "liter", "box", name="inventory_unit", create_type=False)
    unit_enum.create(op.get_bind(), checkfirst=True)

    change_type_enum = postgresql.ENUM(
        "opening_stock", "manual_adjust", "request_delivered", "wastage",
        name="inventory_change_type", create_type=False,
    )
    change_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "inventory_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_name", sa.String(length=150), nullable=False),
        sa.Column("unit", unit_enum, nullable=False),
        sa.Column("current_stock", sa.Numeric(precision=10, scale=2), server_default="0.00", nullable=False),
        sa.Column("reorder_level", sa.Numeric(precision=10, scale=2), server_default="0.00", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_items_franchise_id", "inventory_items", ["franchise_id"])
    op.create_index("ix_inventory_items_is_active", "inventory_items", ["is_active"])
    op.create_index("ix_inventory_items_franchise_active_stock", "inventory_items", ["franchise_id", "is_active", "current_stock"])

    op.create_table(
        "inventory_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inventory_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("performed_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("change_type", change_type_enum, nullable=False),
        sa.Column("quantity_delta", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("balance_after", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["performed_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_transactions_inventory_item_id", "inventory_transactions", ["inventory_item_id"])
    op.create_index("ix_inventory_transactions_franchise_id", "inventory_transactions", ["franchise_id"])
    op.create_index("ix_inventory_transactions_performed_by_id", "inventory_transactions", ["performed_by_id"])
    op.create_index("ix_inventory_transactions_change_type", "inventory_transactions", ["change_type"])
    op.create_index("ix_inv_tx_franchise_item_created", "inventory_transactions", ["franchise_id", "inventory_item_id", "created_at"])


def downgrade() -> None:
    op.drop_table("inventory_transactions")
    op.drop_table("inventory_items")
