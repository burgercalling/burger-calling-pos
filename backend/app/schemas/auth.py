from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.franchise import FranchiseModelType
from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class FranchiseSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    outlet_code: str
    name: str
    model_type: FranchiseModelType
    city: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    franchise_id: UUID | None
    full_name: str
    username: str
    role: UserRole
    permissions: list[str]
    last_login_at: datetime | None
    is_active: bool
    franchise: FranchiseSummary | None = None


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"
    message: str


class MessageResponse(BaseModel):
    message: str
