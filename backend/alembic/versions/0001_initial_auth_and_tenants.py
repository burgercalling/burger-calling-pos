"""initial auth and tenant tables

Revision ID: 0001_initial_auth_and_tenants
Revises:
Create Date: 2026-11-23 19:15:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_auth_and_tenants"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    franchise_model_type = postgresql.ENUM(
        "Signature Restaurant",
        "Express Kiosk",
        "Mini Outlet",
        name="franchise_model_type",
        create_type=False,
    )
    franchise_model_type.create(op.get_bind(), checkfirst=True)

    user_role = postgresql.ENUM(
        "super_admin",
        "franchise_owner",
        "cashier",
        name="user_role",
        create_type=False,
    )
    user_role.create(op.get_bind(), checkfirst=True)

    printer_width_mode = postgresql.ENUM(
        "auto",
        "80mm",
        "58mm",
        name="printer_width_mode",
        create_type=False,
    )
    printer_width_mode.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "franchises",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("outlet_code", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("model_type", franchise_model_type, nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_franchises_outlet_code", "franchises", ["outlet_code"], unique=True)
    op.create_index("ix_franchises_is_active", "franchises", ["is_active"])
    op.create_index("ix_franchises_active_outlet_code", "franchises", ["is_active", "outlet_code"])

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_franchise_id", "users", ["franchise_id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_active", "users", ["is_active"])
    op.create_index("ix_users_franchise_role_active", "users", ["franchise_id", "role", "is_active"])

    op.create_table(
        "settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("brand_name", sa.String(length=150), server_default="Burger Calling", nullable=False),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("receipt_footer", sa.Text(), server_default="100% Pure Veg | Thank you for visiting Burger Calling!", nullable=False),
        sa.Column("tax_enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("tax_label", sa.String(length=50), server_default="GST", nullable=False),
        sa.Column("tax_rate", sa.Numeric(precision=5, scale=2), server_default="0.00", nullable=False),
        sa.Column("gstin", sa.String(length=20), nullable=True),
        sa.Column("currency_code", sa.String(length=10), server_default="INR", nullable=False),
        sa.Column("currency_symbol", sa.String(length=10), server_default="₹", nullable=False),
        sa.Column("date_format", sa.String(length=20), server_default="DD/MM/YYYY", nullable=False),
        sa.Column("timezone", sa.String(length=64), server_default="Asia/Kolkata", nullable=False),
        sa.Column("printer_width_mode", printer_width_mode, server_default="auto", nullable=False),
        sa.Column("default_kot_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("franchise_id"),
    )
    op.create_index("ix_settings_franchise_id", "settings", ["franchise_id"], unique=True)

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("old_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_franchise_id", "audit_logs", ["franchise_id"])
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_franchise_created", "audit_logs", ["franchise_id", "created_at"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])

    op.create_table(
        "activity_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("franchise_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["franchise_id"], ["franchises.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_activity_logs_franchise_id", "activity_logs", ["franchise_id"])
    op.create_index("ix_activity_logs_user_id", "activity_logs", ["user_id"])
    op.create_index("ix_activity_logs_event_type", "activity_logs", ["event_type"])
    op.create_index("ix_activity_logs_franchise_event_created", "activity_logs", ["franchise_id", "event_type", "created_at"])


def downgrade() -> None:
    op.drop_table("activity_logs")
    op.drop_table("audit_logs")
    op.drop_table("settings")
    op.drop_table("users")
    op.drop_table("franchises")
