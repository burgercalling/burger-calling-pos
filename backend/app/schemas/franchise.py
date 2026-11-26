from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.franchise import FranchiseModelType


class FranchiseCreate(BaseModel):
    outlet_code: str = Field(..., min_length=1, max_length=16, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(..., min_length=2, max_length=150)
    model_type: FranchiseModelType
    city: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=5, max_length=500)
    phone: str = Field(..., min_length=7, max_length=20)
    email: EmailStr | None = None

    @field_validator("outlet_code")
    @classmethod
    def normalize_outlet_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("name", "city", "address", "phone")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


class FranchiseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    model_type: FranchiseModelType | None = None
    city: str | None = Field(default=None, min_length=2, max_length=100)
    address: str | None = Field(default=None, min_length=5, max_length=500)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    email: EmailStr | None = None
    is_active: bool | None = None

    @field_validator("name", "city", "address", "phone")
    @classmethod
    def strip_optional_text(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else None


class FranchiseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    outlet_code: str
    name: str
    model_type: FranchiseModelType
    city: str
    address: str
    phone: str
    email: str | None
    is_active: bool
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PaginatedFranchisesResponse(BaseModel):
    items: list[FranchiseResponse]
    total: int
    page: int
    page_size: int
