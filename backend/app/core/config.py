import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "Burger Calling POS API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    DATABASE_URL: str = Field(..., min_length=10)

    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    COOKIE_NAME: str = "bc_access_token"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    COOKIE_DOMAIN: str | None = None

    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    INITIAL_SUPERADMIN_USERNAME: str = Field(..., min_length=3)
    INITIAL_SUPERADMIN_PASSWORD: str = Field(..., min_length=8)
    INITIAL_SUPERADMIN_NAME: str = "Burger Calling Super Admin"

    UPLOAD_ROOT: str = "app/uploads"
    MAX_UPLOAD_SIZE: int = 5_242_880
    ALLOWED_IMAGE_TYPES: Annotated[list[str], NoDecode] = ["jpg", "jpeg", "png", "webp"]

    @property
    def UPLOAD_DIRECTORY(self) -> Path:
        return Path(self.UPLOAD_ROOT)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed.startswith("["):
                try:
                    parsed = json.loads(trimmed)
                    if isinstance(parsed, list):
                        return [str(o).strip() for o in parsed if str(o).strip()]
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in trimmed.split(",") if origin.strip()]
        return value

    @field_validator("ALLOWED_IMAGE_TYPES", mode="before")
    @classmethod
    def parse_allowed_image_types(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed.startswith("["):
                try:
                    parsed = json.loads(trimmed)
                    if isinstance(parsed, list):
                        return [str(ext).strip().lower().lstrip(".") for ext in parsed if str(ext).strip()]
                except json.JSONDecodeError:
                    pass
            return [ext.strip().lower().lstrip(".") for ext in trimmed.split(",") if ext.strip()]
        return [ext.strip().lower().lstrip(".") for ext in value]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
