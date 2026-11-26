"""add stock_requests and stock_request_items tables

Revision ID: 0004_stock_requests
Revises: 0003_inventory_and_transactions
Create Date: 2026-11-23 19:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_stock_requests"
down_revision: Union[str, None] = "0003_inventory_and_transactions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    status_enum = postgresql.ENUM(
        "pending", "approved", "rejected", "packed", "dispatched", "delivered",
        name="stock_request_status", create_type=False,
    )
    status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "stock_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_number", sa.String(length=32), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", status_enum, server_default="pending", nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stock_requests_request_number", "stock_requests", ["request_number"], unique=True)
    op.create_index("ix_stock_requests_franchise_id", "stock_requests", ["franchise_id"])
    op.create_index("ix_stock_requests_requested_by_id", "stock_requests", ["requested_by_id"])
    op.create_index("ix_stock_requests_status", "stock_requests", ["status"])
    op.create_index("ix_stock_requests_franchise_status_created", "stock_requests", ["franchise_id", "status", "created_at"])

    op.create_table(
        "stock_request_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stock_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inventory_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_name_snapshot", sa.String(length=150), nullable=False),
        sa.Column("unit_snapshot", sa.String(length=20), nullable=False),
        sa.Column("requested_qty", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("approved_qty", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.ForeignKeyConstraint(["stock_request_id"], ["stock_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stock_request_items_stock_request_id", "stock_request_items", ["stock_request_id"])
    op.create_index("ix_stock_request_items_inventory_item_id", "stock_request_items", ["inventory_item_id"])


def downgrade() -> None:
    op.drop_table("stock_request_items")
    op.drop_table("stock_requests")
