from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings
from app.schemas.dashboard import Dashboard, FarmSummary
from app.services.dashboard import FarmNotFoundError, build_dashboard, list_farms

router = APIRouter(prefix="/farms", tags=["farms"])


@router.get("", response_model=list[FarmSummary])
def farms() -> list[FarmSummary]:
    return list_farms()


@router.get("/{farm_id}/dashboard", response_model=Dashboard)
def dashboard(farm_id: str, settings: Settings = Depends(get_settings)) -> Dashboard:
    try:
        return build_dashboard(farm_id, data_mode=settings.data_mode)
    except FarmNotFoundError:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found") from None
