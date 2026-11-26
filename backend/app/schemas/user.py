from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole
from app.schemas.auth import FranchiseSummary


class UserCreate(BaseModel):
    franchise_id: UUID | None = None
    full_name: str = Field(..., min_length=2, max_length=150)
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole
    permissions: list[str] | None = None

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, v: str) -> str:
        return v.strip()


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    is_active: bool | None = None
    permissions: list[str] | None = None

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else None


class UserPermissionsUpdate(BaseModel):
    permissions: list[str]


class UserPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)


class UserDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    franchise_id: UUID | None
    full_name: str
    username: str
    role: UserRole
    permissions: list[str]
    last_login_at: datetime | None
    is_active: bool
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    franchise: FranchiseSummary | None = None


class PaginatedUsersResponse(BaseModel):
    items: list[UserDetailResponse]
    total: int
    page: int
    page_size: int
