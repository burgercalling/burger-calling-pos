"""add image_url to categories

Revision ID: 0006_category_image_url
Revises: 0005_customers_and_orders
Create Date: 2026-11-23 20:25:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_category_image_url"
down_revision: Union[str, None] = "0005_customers_and_orders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("categories", "image_url")
