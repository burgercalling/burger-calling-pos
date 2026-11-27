"""v1.1 inventory transaction audit fields and stock request idempotency

Revision ID: 0009_v1_1_inv_sr_fixes
Revises: 0008_v1_1_order_sources
Create Date: 2026-11-27 20:05:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_v1_1_inv_sr_fixes"
down_revision: Union[str, None] = "0008_v1_1_order_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE inventory_change_type ADD VALUE IF NOT EXISTS 'correction'")
        op.execute("ALTER TYPE inventory_change_type ADD VALUE IF NOT EXISTS 'return'")
        op.execute("ALTER TYPE stock_request_status ADD VALUE IF NOT EXISTS 'cancelled'")

    op.add_column(
        "inventory_transactions",
        sa.Column("previous_stock", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.add_column(
        "inventory_transactions",
        sa.Column("reference_type", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "inventory_transactions",
        sa.Column("reference_id", sa.String(length=100), nullable=True),
    )
    op.create_index("ix_inventory_transactions_reference_type", "inventory_transactions", ["reference_type"])
    op.create_index("ix_inventory_transactions_reference_id", "inventory_transactions", ["reference_id"])

    op.add_column(
        "stock_requests",
        sa.Column("inventory_applied", sa.Boolean(), server_default="false", nullable=False),
    )
    op.execute("UPDATE stock_requests SET inventory_applied = true WHERE status = 'delivered'")


def downgrade() -> None:
    op.drop_column("stock_requests", "inventory_applied")
    op.drop_index("ix_inventory_transactions_reference_id", table_name="inventory_transactions")
    op.drop_index("ix_inventory_transactions_reference_type", table_name="inventory_transactions")
    op.drop_column("inventory_transactions", "reference_id")
    op.drop_column("inventory_transactions", "reference_type")
    op.drop_column("inventory_transactions", "previous_stock")
