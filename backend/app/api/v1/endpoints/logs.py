from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.audit_log import AuditLog
from app.models.franchise import Franchise
from app.models.user import User, UserRole
from app.schemas.system import (
    ActivityLogResponse,
    AuditLogResponse,
    PaginatedActivityLogsResponse,
    PaginatedAuditLogsResponse,
)

router = APIRouter(prefix="/logs", tags=["Audit & Activity Logs"])


@router.get("/audit", response_model=PaginatedAuditLogsResponse)
def list_audit_logs(
    franchise_id: UUID | None = Query(default=None),
    action: str | None = Query(default=None, max_length=64),
    entity_type: str | None = Query(default=None, max_length=64),
    search: str | None = Query(default=None, max_length=100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> PaginatedAuditLogsResponse:
    filters = []
    if franchise_id is not None:
        filters.append(AuditLog.franchise_id == franchise_id)
    if action:
        filters.append(AuditLog.action == action.strip().upper())
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type.strip().lower())
    if start_date is not None:
        filters.append(AuditLog.created_at >= datetime.combine(start_date, time.min, tzinfo=timezone.utc))
    if end_date is not None:
        filters.append(AuditLog.created_at <= datetime.combine(end_date, time.max, tzinfo=timezone.utc))
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(AuditLog.entity_type.ilike(term), AuditLog.entity_id.ilike(term), AuditLog.action.ilike(term), User.username.ilike(term), User.full_name.ilike(term)))

    total = db.scalar(select(func.count(AuditLog.id)).outerjoin(User, User.id == AuditLog.actor_user_id).where(*filters)) or 0
    rows = db.execute(
        select(
            AuditLog, User.full_name.label("actor_name"), User.username.label("actor_username"),
            User.role.label("actor_role"), Franchise.outlet_code, Franchise.name.label("outlet_name"),
        )
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .outerjoin(Franchise, Franchise.id == AuditLog.franchise_id)
        .where(*filters).order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()

    items = [
        AuditLogResponse(
            id=r.AuditLog.id, franchise_id=r.AuditLog.franchise_id, outlet_code=r.outlet_code,
            outlet_name=r.outlet_name, actor_user_id=r.AuditLog.actor_user_id, actor_name=r.actor_name,
            actor_username=r.actor_username, actor_role=r.actor_role.value if r.actor_role else None,
            action=r.AuditLog.action, entity_type=r.AuditLog.entity_type, entity_id=r.AuditLog.entity_id,
            old_values=r.AuditLog.old_values, new_values=r.AuditLog.new_values,
            ip_address=r.AuditLog.ip_address, created_at=r.AuditLog.created_at,
        )
        for r in rows
    ]
    return PaginatedAuditLogsResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/activity", response_model=PaginatedActivityLogsResponse)
def list_activity_logs(
    franchise_id: UUID | None = Query(default=None),
    event_type: str | None = Query(default=None, max_length=64),
    search: str | None = Query(default=None, max_length=100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> PaginatedActivityLogsResponse:
    filters = []
    if franchise_id is not None:
        filters.append(ActivityLog.franchise_id == franchise_id)
    if event_type:
        filters.append(ActivityLog.event_type == event_type.strip().upper())
    if start_date is not None:
        filters.append(ActivityLog.created_at >= datetime.combine(start_date, time.min, tzinfo=timezone.utc))
    if end_date is not None:
        filters.append(ActivityLog.created_at <= datetime.combine(end_date, time.max, tzinfo=timezone.utc))
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(ActivityLog.description.ilike(term), ActivityLog.event_type.ilike(term), User.username.ilike(term), User.full_name.ilike(term)))

    total = db.scalar(select(func.count(ActivityLog.id)).outerjoin(User, User.id == ActivityLog.user_id).where(*filters)) or 0
    rows = db.execute(
        select(
            ActivityLog, User.full_name.label("user_name"), User.username.label("user_username"),
            Franchise.outlet_code, Franchise.name.label("outlet_name"),
        )
        .outerjoin(User, User.id == ActivityLog.user_id)
        .outerjoin(Franchise, Franchise.id == ActivityLog.franchise_id)
        .where(*filters).order_by(ActivityLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()

    items = [
        ActivityLogResponse(
            id=r.ActivityLog.id, franchise_id=r.ActivityLog.franchise_id, outlet_code=r.outlet_code,
            outlet_name=r.outlet_name, user_id=r.ActivityLog.user_id, user_name=r.user_name,
            user_username=r.user_username, event_type=r.ActivityLog.event_type,
            description=r.ActivityLog.description, ip_address=r.ActivityLog.ip_address,
            created_at=r.ActivityLog.created_at,
        )
        for r in rows
    ]
    return PaginatedActivityLogsResponse(items=items, total=total, page=page, page_size=page_size)
