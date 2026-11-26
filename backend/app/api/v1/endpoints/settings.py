from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.setting import Setting
from app.models.user import User, UserRole
from app.schemas.system import SettingResponse, SettingUpdate
from app.services.audit import get_client_ip, record_audit_log
from app.storage.upload_service import LocalStorageService, get_upload_service

router = APIRouter(prefix="/settings", tags=["Settings"])


def _setting_snapshot(s: Setting) -> dict:
    return {
        "brand_name": s.brand_name, "logo_url": s.logo_url, "receipt_footer": s.receipt_footer,
        "tax_enabled": s.tax_enabled, "tax_label": s.tax_label, "tax_rate": str(s.tax_rate),
        "gstin": s.gstin, "currency_code": s.currency_code, "currency_symbol": s.currency_symbol,
        "date_format": s.date_format, "timezone": s.timezone,
        "printer_width_mode": s.printer_width_mode.value, "default_kot_enabled": s.default_kot_enabled,
    }


@router.get("/global", response_model=SettingResponse)
def get_global_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> SettingResponse:
    setting = db.scalar(select(Setting).where(Setting.franchise_id.is_(None)).limit(1))
    if setting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Global settings not found")
    return SettingResponse.model_validate(setting)


@router.patch("/global", response_model=SettingResponse)
def update_global_settings(
    payload: SettingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    storage: LocalStorageService = Depends(get_upload_service),
) -> SettingResponse:
    setting = db.scalar(select(Setting).where(Setting.franchise_id.is_(None)).limit(1))
    if setting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Global settings not found")

    old_values = _setting_snapshot(setting)
    old_logo = setting.logo_url
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(setting, field, value)

    if "logo_url" in update_data and old_logo and old_logo != setting.logo_url:
        storage.delete_image(old_logo)

    client_ip = get_client_ip(request)
    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=None, action="SETTINGS_CHANGE",
        entity_type="global_settings", entity_id=setting.id,
        old_values=old_values, new_values=_setting_snapshot(setting), ip_address=client_ip,
    )
    db.add(ActivityLog(
        franchise_id=None, user_id=current_user.id, event_type="SETTINGS_CHANGE",
        description="Updated Global POS Settings", ip_address=client_ip, user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(setting)
    return SettingResponse.model_validate(setting)


@router.get("/outlet", response_model=SettingResponse)
def get_outlet_settings(
    franchise_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingResponse:
    target_franchise_id = franchise_id if current_user.role == UserRole.SUPER_ADMIN else current_user.franchise_id
    if target_franchise_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="franchise_id is required")
    setting = db.scalar(select(Setting).where(Setting.franchise_id == target_franchise_id).limit(1))
    if setting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlet settings not found")
    return SettingResponse.model_validate(setting)


@router.patch("/outlet", response_model=SettingResponse)
def update_outlet_settings(
    payload: SettingUpdate,
    request: Request,
    franchise_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: LocalStorageService = Depends(get_upload_service),
) -> SettingResponse:
    if current_user.role == UserRole.SUPER_ADMIN:
        target_franchise_id = franchise_id
    elif current_user.role == UserRole.FRANCHISE_OWNER and "settings:manage_outlet" in (current_user.permissions or []):
        target_franchise_id = current_user.franchise_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing permission: settings:manage_outlet")

    if target_franchise_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="franchise_id is required")

    setting = db.scalar(select(Setting).where(Setting.franchise_id == target_franchise_id).limit(1))
    if setting is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlet settings not found")

    old_values = _setting_snapshot(setting)
    old_logo = setting.logo_url
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(setting, field, value)

    if "logo_url" in update_data and old_logo and old_logo != setting.logo_url:
        storage.delete_image(old_logo)

    client_ip = get_client_ip(request)
    record_audit_log(
        db, actor_user_id=current_user.id, franchise_id=target_franchise_id, action="SETTINGS_CHANGE",
        entity_type="outlet_settings", entity_id=setting.id,
        old_values=old_values, new_values=_setting_snapshot(setting), ip_address=client_ip,
    )
    db.add(ActivityLog(
        franchise_id=target_franchise_id, user_id=current_user.id, event_type="SETTINGS_CHANGE",
        description="Updated outlet receipt & printer settings", ip_address=client_ip, user_agent=request.headers.get("User-Agent"),
    ))
    db.commit()
    db.refresh(setting)
    return SettingResponse.model_validate(setting)
