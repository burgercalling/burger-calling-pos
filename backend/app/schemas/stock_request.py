from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.stock_request import StockRequestStatus
from app.schemas.auth import FranchiseSummary
from app.schemas.inventory import ActorSummary


class StockRequestItemInput(BaseModel):
    inventory_item_id: UUID
    requested_qty: Decimal = Field(
        ..., gt=Decimal("0.00"), max_digits=10, decimal_places=2
    )


class StockRequestCreate(BaseModel):
    items: list[StockRequestItemInput] = Field(..., min_length=1)
    remarks: str | None = Field(default=None, max_length=500)


class StockRequestItemApproval(BaseModel):
    item_id: UUID
    approved_qty: Decimal = Field(
        ..., ge=Decimal("0.00"), max_digits=10, decimal_places=2
    )


class StockRequestReview(BaseModel):
    decision: Literal["approved", "rejected"]
    admin_notes: str | None = Field(default=None, max_length=500)
    items: list[StockRequestItemApproval] | None = None

    @model_validator(mode="after")
    def validate_review(self) -> "StockRequestReview":
        if self.decision == "rejected":
            if not self.admin_notes or len(self.admin_notes.strip()) < 3:
                raise ValueError("admin_notes is required when rejecting a request")
        return self


class StockRequestStatusAdvance(BaseModel):
    next_status: StockRequestStatus
    admin_notes: str | None = Field(default=None, max_length=500)


class StockRequestItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stock_request_id: UUID
    inventory_item_id: UUID
    item_name_snapshot: str
    unit_snapshot: str
    requested_qty: Decimal
    approved_qty: Decimal | None


class StockRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    request_number: str
    franchise_id: UUID
    requested_by_id: UUID
    reviewed_by_id: UUID | None
    status: StockRequestStatus
    inventory_applied: bool = False
    remarks: str | None
    admin_notes: str | None
    reviewed_at: datetime | None
    delivered_at: datetime | None
    created_at: datetime
    updated_at: datetime
    franchise: FranchiseSummary | None = None
    requested_by: ActorSummary | None = None
    reviewed_by: ActorSummary | None = None
    items: list[StockRequestItemResponse]


class PaginatedStockRequestsResponse(BaseModel):
    items: list[StockRequestResponse]
    total: int
    page: int
    page_size: int
