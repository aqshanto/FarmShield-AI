from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings
from app.i18n import Lang
from app.i18n.localize import localize_overview, localize_point
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.schemas.map import MapOverview, PointRisk
from app.services.map import get_map_overview
from app.services.point_risk import PointDataPendingError, PointRiskError, point_risk

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/overview", response_model=MapOverview)
async def overview(
    lang: Lang = Query(default="en", description="en or bn (Bengali)"),
    settings: Settings = Depends(get_settings),
    pipeline: PipelineService = Depends(get_pipeline),
) -> MapOverview:
    return localize_overview(await get_map_overview(settings.data_mode, pipeline), lang)


@router.get("/point", response_model=PointRisk)
async def point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-540, le=540, description="Wrapped into -180..180"),
    crop: str = Query(default="rice", description="rice, wheat, maize, potato, tomato, lentil, mustard or jute"),
    lang: Lang = Query(default="en", description="en or bn (Bengali)"),
    settings: Settings = Depends(get_settings),
    pipeline: PipelineService = Depends(get_pipeline),
) -> PointRisk:
    """Flood, water and crop risk for any spot on Earth, computed on demand from NASA data."""
    if settings.data_mode != "live":
        raise HTTPException(status_code=409, detail="Checking any spot on Earth needs live NASA data, and the server is running the demo scenario.")
    try:
        result = await point_risk(pipeline, lat, lon, crop, lang)
    except PointRiskError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    except PointDataPendingError:
        raise HTTPException(status_code=503, detail="Still downloading NASA data for this spot. Try again in a moment.") from None
    return localize_point(result, lang)
