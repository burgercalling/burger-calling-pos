from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.setting import PrinterWidthMode


class SettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    franchise_id: UUID | None
    brand_name: str
    logo_url: str | None
    receipt_footer: str
    tax_enabled: bool
    tax_label: str
    tax_rate: Decimal
    gstin: str | None
    currency_code: str
    currency_symbol: str
    date_format: str
    timezone: str
    printer_width_mode: PrinterWidthMode
    default_kot_enabled: bool
    updated_at: datetime


class SettingUpdate(BaseModel):
    brand_name: str | None = Field(default=None, min_length=2, max_length=150)
    logo_url: str | None = None
    receipt_footer: str | None = Field(default=None, min_length=2, max_length=500)
    tax_enabled: bool | None = None
    tax_label: str | None = Field(default=None, min_length=1, max_length=50)
    tax_rate: Decimal | None = Field(
        default=None, ge=Decimal("0.00"), le=Decimal("100.00"), max_digits=5, decimal_places=2
    )
    gstin: str | None = Field(default=None, max_length=20)
    currency_code: str | None = Field(default=None, min_length=3, max_length=10)
    currency_symbol: str | None = Field(default=None, min_length=1, max_length=10)
    date_format: str | None = Field(default=None, min_length=4, max_length=20)
    timezone: str | None = Field(default=None, min_length=2, max_length=64)
    printer_width_mode: PrinterWidthMode | None = None
    default_kot_enabled: bool | None = None


class AuditLogResponse(BaseModel):
    id: UUID
    franchise_id: UUID | None
    outlet_code: str | None
    outlet_name: str | None
    actor_user_id: UUID | None
    actor_name: str | None
    actor_username: str | None
    actor_role: str | None
    action: str
    entity_type: str
    entity_id: str | None
    old_values: dict[str, Any] | None
    new_values: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime


class PaginatedAuditLogsResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int


class ActivityLogResponse(BaseModel):
    id: UUID
    franchise_id: UUID | None
    outlet_code: str | None
    outlet_name: str | None
    user_id: UUID | None
    user_name: str | None
    user_username: str | None
    event_type: str
    description: str | None
    ip_address: str | None
    created_at: datetime


class PaginatedActivityLogsResponse(BaseModel):
    items: list[ActivityLogResponse]
    total: int
    page: int
    page_size: int


class RestoreResultResponse(BaseModel):
    message: str
    schema_version: str
    restored_counts: dict[str, int]
