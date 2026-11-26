from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.user import User, UserRole
from app.schemas.auth import AuthResponse, LoginRequest, MessageResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )


@router.post("/login", response_model=AuthResponse)
def outlet_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    username = payload.username.strip().lower()
    user = db.scalar(
        select(User)
        .options(joinedload(User.franchise))
        .where(User.username == username)
    )

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This portal is restricted to outlet owners and cashiers",
        )

    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    if (
        user.franchise is None
        or not user.franchise.is_active
        or user.franchise.deleted_at is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This outlet is currently suspended or inactive",
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.add(
        ActivityLog(
            franchise_id=user.franchise_id,
            user_id=user.id,
            event_type="LOGIN",
            description=f"{user.role.value} '{user.username}' signed in",
            ip_address=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=user.id,
        role=user.role.value,
        franchise_id=user.franchise_id,
    )
    _set_auth_cookie(response, token)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=token,
        message="Login successful",
    )


@router.post("/superadmin/login", response_model=AuthResponse)
def superadmin_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    username = payload.username.strip().lower()
    user = db.scalar(
        select(User).where(
            User.username == username,
            User.role == UserRole.SUPER_ADMIN,
        )
    )

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.add(
        ActivityLog(
            franchise_id=None,
            user_id=user.id,
            event_type="SUPERADMIN_LOGIN",
            description=f"Super Admin '{user.username}' signed in",
            ip_address=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=user.id,
        role=user.role.value,
        franchise_id=None,
    )
    _set_auth_cookie(response, token)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=token,
        message="Super Admin login successful",
    )


@router.get("/me", response_model=UserResponse)
def read_current_user(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    db.add(
        ActivityLog(
            franchise_id=current_user.franchise_id,
            user_id=current_user.id,
            event_type="LOGOUT",
            description=f"User '{current_user.username}' signed out",
            ip_address=_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()

    _clear_auth_cookie(response)
    return MessageResponse(message="Logged out successfully")
