from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.inventory import InventoryChangeType, InventoryUnit
from app.schemas.auth import FranchiseSummary


class InventoryItemCreate(BaseModel):
    franchise_id: UUID | None = None
    broadcast_all_active: bool = False
    item_name: str = Field(..., min_length=2, max_length=150)
    unit: InventoryUnit
    opening_stock: Decimal = Field(
        default=Decimal("0.00"), ge=Decimal("0.00"), max_digits=10, decimal_places=2
    )
    reorder_level: Decimal = Field(
        default=Decimal("0.00"), ge=Decimal("0.00"), max_digits=10, decimal_places=2
    )

    @field_validator("item_name")
    @classmethod
    def strip_item_name(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def validate_target_franchise(self) -> "InventoryItemCreate":
        if not self.broadcast_all_active and self.franchise_id is None:
            raise ValueError(
                "Either franchise_id or broadcast_all_active=true must be provided"
            )
        return self


class InventoryAdjustRequest(BaseModel):
    change_type: Literal["manual_adjust", "wastage", "correction", "return"] = "manual_adjust"
    quantity_delta: Decimal = Field(..., max_digits=10, decimal_places=2)
    remarks: str = Field(..., min_length=3, max_length=500)

    @field_validator("remarks")
    @classmethod
    def strip_remarks(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 3:
            raise ValueError("Remarks must be at least 3 characters")
        return cleaned

    @model_validator(mode="after")
    def validate_delta(self) -> "InventoryAdjustRequest":
        if self.quantity_delta == Decimal("0.00"):
            raise ValueError("quantity_delta cannot be 0")
        if self.change_type == "wastage" and self.quantity_delta > Decimal("0.00"):
            raise ValueError("Wastage adjustment must use a negative quantity_delta")
        return self


class InventoryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    franchise_id: UUID
    item_name: str
    unit: InventoryUnit
    current_stock: Decimal
    reorder_level: Decimal
    is_active: bool
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    franchise: FranchiseSummary | None = None


class PaginatedInventoryItemsResponse(BaseModel):
    items: list[InventoryItemResponse]
    total: int
    page: int
    page_size: int


class InventoryBroadcastResponse(BaseModel):
    created_count: int
    skipped_count: int
    items: list[InventoryItemResponse]


class ActorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    username: str


class InventoryItemSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_name: str
    unit: InventoryUnit


class InventoryTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inventory_item_id: UUID
    franchise_id: UUID
    performed_by_id: UUID
    change_type: InventoryChangeType
    quantity_delta: Decimal
    previous_stock: Decimal | None = None
    balance_after: Decimal
    reference_type: str | None = None
    reference_id: str | None = None
    remarks: str
    created_at: datetime
    inventory_item: InventoryItemSummary | None = None
    performed_by: ActorSummary | None = None


class PaginatedInventoryTransactionsResponse(BaseModel):
    items: list[InventoryTransactionResponse]
    total: int
    page: int
    page_size: int
