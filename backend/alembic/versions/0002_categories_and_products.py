"""add categories and products tables

Revision ID: 0002_categories_and_products
Revises: 0001_initial_auth_and_tenants
Create Date: 2026-11-23 19:25:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_categories_and_products"
down_revision: Union[str, None] = "0001_initial_auth_and_tenants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    product_item_type_enum = postgresql.ENUM(
        "regular",
        "combo",
        "addon",
        name="product_item_type",
        create_type=False,
    )
    product_item_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_categories_name", "categories", ["name"], unique=True)
    op.create_index("ix_categories_display_order", "categories", ["display_order"])
    op.create_index("ix_categories_is_active", "categories", ["is_active"])
    op.create_index("ix_categories_active_order", "categories", ["is_active", "display_order"])

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("item_type", product_item_type_enum, server_default="regular", nullable=False),
        sa.Column("is_available", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_category_id", "products", ["category_id"])
    op.create_index("ix_products_sku", "products", ["sku"], unique=True)
    op.create_index("ix_products_item_type", "products", ["item_type"])
    op.create_index("ix_products_is_available", "products", ["is_available"])
    op.create_index("ix_products_is_active", "products", ["is_active"])
    op.create_index("ix_products_category_type_active", "products", ["category_id", "item_type", "is_active"])
    op.create_index("ix_products_available_active", "products", ["is_available", "is_active"])


def downgrade() -> None:
    op.drop_table("products")
    op.drop_table("categories")
