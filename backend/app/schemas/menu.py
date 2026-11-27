from datetime import datetime
from decimal import Decimal
from typing import Literal
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


class ProductPriceInput(BaseModel):
    order_source: str = Field(..., min_length=1, max_length=50)
    price: Decimal = Field(..., gt=Decimal("0.00"), max_digits=10, decimal_places=2)

    @field_validator("order_source")
    @classmethod
    def normalize_source(cls, v: str) -> str:
        return v.strip().lower()


class ProductPriceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    order_source: str
    price: Decimal


class RecipeItemInput(BaseModel):
    ingredient_name: str = Field(..., min_length=1, max_length=150)
    quantity_required: Decimal = Field(..., gt=Decimal("0.000"), max_digits=10, decimal_places=3)
    unit: str = Field(default="pcs", min_length=1, max_length=20)

    @field_validator("ingredient_name")
    @classmethod
    def strip_ingredient(cls, v: str) -> str:
        return v.strip()

    @field_validator("unit")
    @classmethod
    def normalize_unit(cls, v: str) -> str:
        return v.strip().lower()


class RecipeItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    ingredient_name: str
    quantity_required: Decimal
    unit: str


class ProductRecipeUpdate(BaseModel):
    items: list[RecipeItemInput] = Field(default_factory=list)


class ProductCreate(BaseModel):
    category_id: UUID
    sku: str | None = Field(default=None, max_length=64)
    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    price: Decimal = Field(..., gt=Decimal("0.00"), max_digits=10, decimal_places=2)
    cost_price: Decimal | None = Field(default=None, ge=Decimal("0.00"), max_digits=10, decimal_places=2)
    tax_rate: Decimal | None = Field(default=None, ge=Decimal("0.00"), le=Decimal("100.00"), max_digits=5, decimal_places=2)
    image_url: str | None = None
    item_type: ProductItemType = ProductItemType.REGULAR
    is_available: bool = True
    prices: list[ProductPriceInput] | None = None

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
    cost_price: Decimal | None = Field(
        default=None, ge=Decimal("0.00"), max_digits=10, decimal_places=2
    )
    tax_rate: Decimal | None = Field(
        default=None, ge=Decimal("0.00"), le=Decimal("100.00"), max_digits=5, decimal_places=2
    )
    image_url: str | None = None
    item_type: ProductItemType | None = None
    is_available: bool | None = None
    is_active: bool | None = None
    prices: list[ProductPriceInput] | None = None

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
    cost_price: Decimal | None = None
    tax_rate: Decimal | None = None
    image_url: str | None
    item_type: ProductItemType
    is_available: bool
    is_active: bool
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    category: CategorySummary | None = None
    recipes: list[RecipeItemResponse] = Field(default_factory=list)
    prices: list[ProductPriceResponse] = Field(default_factory=list)


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


class MediaUrlUploadRequest(BaseModel):
    image_url: str = Field(..., min_length=10, max_length=2048)
    folder: Literal["products", "categories", "logos"] = "products"


class BulkImportRow(BaseModel):
    row_number: int
    category: str
    name: str
    description: str | None = None
    price: Decimal | None = None
    dine_in_price: Decimal | None = None
    takeaway_price: Decimal | None = None
    swiggy_price: Decimal | None = None
    zomato_price: Decimal | None = None
    cost_price: Decimal | None = None
    image_url: str | None = None
    is_available: bool = True
    sku: str | None = None
    tax_rate: Decimal | None = None
    item_type: ProductItemType = ProductItemType.REGULAR
    status: Literal["create", "update", "skip", "error"] = "create"
    error: str | None = None


class BulkImportPreviewResponse(BaseModel):
    total_rows: int
    valid_creates: int
    valid_updates: int
    skipped: int
    errors: int
    rows: list[BulkImportRow]


class BulkImportCommitRequest(BaseModel):
    rows: list[BulkImportRow]
    update_existing: bool = True


class BulkImportCommitResponse(BaseModel):
    imported: int
    updated: int
    failed: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


class ZomatoImportRowInput(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    price: Decimal = Field(..., gt=Decimal("0.00"))
    cost_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    image_url: str | None = None
    is_available: bool = True
    sku: str | None = None
    tax_rate: Decimal | None = Field(default=None, ge=Decimal("0.00"), le=Decimal("100.00"))
    item_type: ProductItemType = ProductItemType.REGULAR


class ZomatoImportRequest(BaseModel):
    rows: list[ZomatoImportRowInput]
    update_existing: bool = False
