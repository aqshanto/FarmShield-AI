from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.map import MapOverview
from app.services.map import build_map_overview

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/overview", response_model=MapOverview)
def overview(settings: Settings = Depends(get_settings)) -> MapOverview:
    return build_map_overview(data_mode=settings.data_mode)
