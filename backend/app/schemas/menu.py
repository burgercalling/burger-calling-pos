from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.product import ProductItemType


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    image_url: str | None = None
    display_order: int = Field(default=0, ge=0, le=10000)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    image_url: str | None = None
    display_order: int | None = Field(default=None, ge=0, le=10000)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_optional_name(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else None


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    image_url: str | None
    display_order: int
    is_active: bool
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class ProductCreate(BaseModel):
    category_id: UUID
    sku: str | None = Field(default=None, max_length=64)
    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    price: Decimal = Field(..., gt=Decimal("0.00"), max_digits=10, decimal_places=2)
    image_url: str | None = None
    item_type: ProductItemType = ProductItemType.REGULAR
    is_available: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip().upper()
        return cleaned or None


class ProductUpdate(BaseModel):
    category_id: UUID | None = None
    sku: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    price: Decimal | None = Field(
        default=None, gt=Decimal("0.00"), max_digits=10, decimal_places=2
    )
    image_url: str | None = None
    item_type: ProductItemType | None = None
    is_available: bool | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else None

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip().upper()
        return cleaned or None


class ProductAvailabilityUpdate(BaseModel):
    is_available: bool


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    sku: str | None
    name: str
    description: str | None
    price: Decimal
    image_url: str | None
    item_type: ProductItemType
    is_available: bool
    is_active: bool
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    category: CategorySummary | None = None


class PaginatedProductsResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int


class MediaUploadResponse(BaseModel):
    image_url: str
    relative_path: str
    filename: str
    folder: str
    bytes: int
    content_type: str
