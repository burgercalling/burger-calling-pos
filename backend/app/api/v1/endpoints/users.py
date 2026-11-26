from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.permissions import (
    CASHIER_ALLOWED_PERMISSIONS,
    DEFAULT_ROLE_PERMISSIONS,
    VALID_PERMISSION_KEYS,
)
from app.core.security import hash_password
from app.db.session import get_db
from app.models.franchise import Franchise
from app.models.user import User, UserRole
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    PaginatedUsersResponse,
    UserCreate,
    UserDetailResponse,
    UserPasswordReset,
    UserPermissionsUpdate,
    UserUpdate,
)
from app.services.audit import get_client_ip, record_audit_log

router = APIRouter(prefix="/users", tags=["Users & Cashiers"])


def _user_snapshot(u: User) -> dict:
    return {
        "franchise_id": str(u.franchise_id) if u.franchise_id else None,
        "full_name": u.full_name,
        "username": u.username,
        "role": u.role.value,
        "permissions": list(u.permissions or []),
        "is_active": u.is_active,
        "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
    }


def _require_user_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.SUPER_ADMIN:
        return current_user
    if (
        current_user.role == UserRole.FRANCHISE_OWNER
        and "users:manage_cashiers" in (current_user.permissions or [])
    ):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to manage users",
    )


def _validate_permissions(permissions: list[str], target_role: UserRole) -> list[str]:
    unique_perms = list(dict.fromkeys(permissions))
    invalid = [p for p in unique_perms if p not in VALID_PERMISSION_KEYS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid permission keys: {', '.join(invalid)}",
        )
    if target_role == UserRole.CASHIER:
        disallowed = [p for p in unique_perms if p not in CASHIER_ALLOWED_PERMISSIONS]
        if disallowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permissions not allowed for cashier role: {', '.join(disallowed)}",
            )
    return unique_perms


def _get_scoped_target_user(db: Session, target_user_id: UUID, actor: User) -> User:
    target = db.scalar(
        select(User)
        .options(joinedload(User.franchise))
        .where(User.id == target_user_id, User.deleted_at.is_(None))
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin accounts cannot be modified via this endpoint",
        )

    if actor.role == UserRole.FRANCHISE_OWNER:
        if target.franchise_id != actor.franchise_id or target.role != UserRole.CASHIER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Franchise owners can only manage cashiers in their own outlet",
            )

    return target


@router.post("", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_user_manager),
) -> UserDetailResponse:
    if payload.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create super_admin accounts via API")

    if current_user.role == UserRole.FRANCHISE_OWNER:
        if payload.role != UserRole.CASHIER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Franchise owners can only create cashier accounts")
        target_franchise_id = current_user.franchise_id
    else:
        if payload.franchise_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="franchise_id is required")
        target_franchise_id = payload.franchise_id

    franchise = db.scalar(
        select(Franchise).where(Franchise.id == target_franchise_id, Franchise.deleted_at.is_(None))
    )
    if franchise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target franchise not found")

    existing_username = db.scalar(select(User.id).where(User.username == payload.username))
    if existing_username is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Username '{payload.username}' is already taken")

    permissions = (
        _validate_permissions(payload.permissions, payload.role)
        if payload.permissions is not None
        else list(DEFAULT_ROLE_PERMISSIONS[payload.role])
    )

    user = User(
        franchise_id=target_franchise_id,
        full_name=payload.full_name,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        permissions=permissions,
        is_active=True,
    )
    db.add(user)
    db.flush()

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=target_franchise_id,
        action="CREATE",
        entity_type="user",
        entity_id=user.id,
        old_values=None,
        new_values=_user_snapshot(user),
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)

    return UserDetailResponse.model_validate(user)


@router.get("", response_model=PaginatedUsersResponse)
def list_users(
    franchise_id: UUID | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_user_manager),
) -> PaginatedUsersResponse:
    filters = [User.deleted_at.is_(None), User.role != UserRole.SUPER_ADMIN]

    if current_user.role == UserRole.FRANCHISE_OWNER:
        filters.append(User.franchise_id == current_user.franchise_id)
        filters.append(User.role == UserRole.CASHIER)
    else:
        if franchise_id is not None:
            filters.append(User.franchise_id == franchise_id)
        if role is not None:
            filters.append(User.role == role)

    if is_active is not None:
        filters.append(User.is_active == is_active)

    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(User.full_name.ilike(term), User.username.ilike(term)))

    total = db.scalar(select(func.count(User.id)).where(*filters)) or 0
    items = db.scalars(
        select(User)
        .options(joinedload(User.franchise))
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return PaginatedUsersResponse(
        items=[UserDetailResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{user_id}", response_model=UserDetailResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_user_manager),
) -> UserDetailResponse:
    target = _get_scoped_target_user(db, user_id, current_user)
    old_values = _user_snapshot(target)

    if payload.full_name is not None:
        target.full_name = payload.full_name
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.permissions is not None:
        target.permissions = _validate_permissions(payload.permissions, target.role)

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=target.franchise_id,
        action="UPDATE",
        entity_type="user",
        entity_id=target.id,
        old_values=old_values,
        new_values=_user_snapshot(target),
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(target)

    return UserDetailResponse.model_validate(target)


@router.patch("/{user_id}/permissions", response_model=UserDetailResponse)
def update_user_permissions(
    user_id: UUID,
    payload: UserPermissionsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_user_manager),
) -> UserDetailResponse:
    target = _get_scoped_target_user(db, user_id, current_user)
    old_values = _user_snapshot(target)

    target.permissions = _validate_permissions(payload.permissions, target.role)

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=target.franchise_id,
        action="PERMISSIONS_UPDATE",
        entity_type="user",
        entity_id=target.id,
        old_values=old_values,
        new_values=_user_snapshot(target),
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(target)

    return UserDetailResponse.model_validate(target)


@router.post("/{user_id}/reset-password", response_model=MessageResponse)
def reset_user_password(
    user_id: UUID,
    payload: UserPasswordReset,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_user_manager),
) -> MessageResponse:
    target = _get_scoped_target_user(db, user_id, current_user)
    target.password_hash = hash_password(payload.new_password)

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=target.franchise_id,
        action="PASSWORD_RESET",
        entity_type="user",
        entity_id=target.id,
        old_values=None,
        new_values={"username": target.username, "password_reset": True},
        ip_address=get_client_ip(request),
    )
    db.commit()

    return MessageResponse(message=f"Password updated for '{target.username}'")


@router.delete("/{user_id}", response_model=UserDetailResponse)
def soft_delete_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_user_manager),
) -> UserDetailResponse:
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")

    target = _get_scoped_target_user(db, user_id, current_user)
    old_values = _user_snapshot(target)

    target.is_active = False
    target.deleted_at = datetime.now(timezone.utc)

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=target.franchise_id,
        action="SOFT_DELETE",
        entity_type="user",
        entity_id=target.id,
        old_values=old_values,
        new_values=_user_snapshot(target),
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(target)

    return UserDetailResponse.model_validate(target)
