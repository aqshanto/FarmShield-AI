from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.data.sources import NASA_SOURCES
from app.schemas.meta import DataSource, HealthStatus, Region

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthStatus)
def health(settings: Settings = Depends(get_settings)) -> HealthStatus:
    return HealthStatus(
        status="ok",
        app=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        data_mode=settings.data_mode,
    )


@router.get("/sources", response_model=list[DataSource])
def list_sources() -> tuple[DataSource, ...]:
    return NASA_SOURCES


@router.get("/region/default", response_model=Region)
def default_region(settings: Settings = Depends(get_settings)) -> Region:
    return Region(
        name=settings.default_region_name,
        lat=settings.default_region_lat,
        lon=settings.default_region_lon,
        zoom=settings.default_region_zoom,
    )
