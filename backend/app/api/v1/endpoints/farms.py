from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from datetime import UTC, datetime, timedelta

from app.pipeline import farm_locations
from app.data.sample.farms import SAMPLE_FARMS
from app.i18n import Lang
from app.i18n.localize import localize_dashboard, localize_farms
from app.risk.live import (
    SOURCE_NAMES,
    crop_module,
    crop_recommendations,
    flood_recommendations,
    live_crop,
    live_flood,
    live_water,
    water_recommendations,
)
from app.schemas.dashboard import Dashboard, FarmSummary, RiskAction, RiskFactor
from app.schemas.flood import CropReport, FloodInputsOut, FloodReport, RainDay, WaterReport
from app.services.dashboard import list_farms
from app.services.farm_access import load_dashboard

router = APIRouter(prefix="/farms", tags=["farms"])


@router.get("", response_model=list[FarmSummary])
def farms(lang: Lang = Query(default="en", description="en or bn (Bengali)")) -> list[FarmSummary]:
    return localize_farms(list_farms(), lang)


@router.get("/{farm_id}/dashboard", response_model=Dashboard)
async def dashboard(
    farm_id: str,
    name: str | None = Query(default=None, max_length=60, description="Display name for a farmer's own farm"),
    lang: Lang = Query(default="en", description="en or bn (Bengali)"),
    settings: Settings = Depends(get_settings),
    pipeline: PipelineService = Depends(get_pipeline),
) -> Dashboard:
    """A demo farm, or a farmer's own field (`my_<lat>_<lon>_<crop>`, see /locate and /crops)."""
    return localize_dashboard(await load_dashboard(farm_id, settings.data_mode, pipeline, name, lang), lang, custom_name_given=bool(name))


@router.get("/{farm_id}/flood", response_model=FloodReport)
def flood_report(farm_id: str, pipeline: PipelineService = Depends(get_pipeline)) -> FloodReport:
    location = next((loc for loc in farm_locations() if loc.id == farm_id), None)
    if location is None:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found")
    now = datetime.now(UTC)
    today = (now + timedelta(hours=6)).date()  # Bangladesh calendar day
    live = live_flood(pipeline, location, today)
    if live is None:
        raise HTTPException(status_code=503, detail="Not enough recent rainfall data yet. Try again after the next NASA refresh.")
    a, i = live.assessment, live.inputs
    window = [r for r in i.rain if today - timedelta(days=6) <= r.date <= today + timedelta(days=6)]
    return FloodReport(
        farm_id=farm_id,
        generated_at=now,
        score=a.score,
        level=a.level,
        headline=a.headline,
        explanation=a.explanation,
        confidence=a.confidence,
        factors=[RiskFactor(id=f.id, label=f.label, score=f.score, weight=f.weight, detail=f.detail, source=f.source) for f in a.factors],
        rain_past3_mm=a.rain_past3_mm,
        rain_next3_mm=a.rain_next3_mm,
        rain=[RainDay(date=r.date, mm=round(r.mm, 1), source=SOURCE_NAMES.get(r.source, r.source), forecast=r.forecast) for r in window],
        trend=live.trend,
        inputs=FloodInputsOut(
            saturation=i.saturation,
            saturation_source=i.saturation_source,
            saturation_date=i.saturation_date,
            normal_mm_per_day=i.normal_mm_per_day,
            elevation_m=i.elevation_m,
        ),
        advice=flood_recommendations(live),
    )


@router.get("/{farm_id}/water", response_model=WaterReport)
def water_report(farm_id: str, pipeline: PipelineService = Depends(get_pipeline)) -> WaterReport:
    location = next((loc for loc in farm_locations() if loc.id == farm_id), None)
    if location is None:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found")
    now = datetime.now(UTC)
    today = (now + timedelta(hours=6)).date()  # Bangladesh calendar day
    live = live_water(pipeline, location, today)
    if live is None:
        raise HTTPException(status_code=503, detail="Not enough soil or rainfall data yet. Try again after the next NASA refresh.")
    a = live.assessment
    return WaterReport(
        farm_id=farm_id,
        generated_at=now,
        score=a.score,
        level=a.level,
        status=a.status,
        headline=a.headline,
        explanation=a.explanation,
        confidence=a.confidence,
        factors=[RiskFactor(id=f.id, label=f.label, score=f.score, weight=f.weight, detail=f.detail, source=f.source) for f in a.factors],
        action=RiskAction(kind=a.action.kind, title=a.action.title, detail=a.action.detail),
        days_since_good_rain=a.days_since_good_rain,
        rain_next5_mm=a.rain_next5_mm,
        trend=live.trend,
        advice=water_recommendations(live),
    )


@router.get("/{farm_id}/crop", response_model=CropReport)
def crop_report(farm_id: str, pipeline: PipelineService = Depends(get_pipeline)) -> CropReport:
    location = next((loc for loc in farm_locations() if loc.id == farm_id), None)
    if location is None:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found")
    now = datetime.now(UTC)
    today = (now + timedelta(hours=6)).date()  # Bangladesh calendar day
    water = live_water(pipeline, location, today)
    flood = live_flood(pipeline, location, today)
    live = live_crop(pipeline, location, today, SAMPLE_FARMS[farm_id]["farm"]["crop"], water=water, flood=flood)
    if live is None:
        raise HTTPException(status_code=503, detail="Not enough weather data yet. Try again after the next NASA refresh.")
    module = crop_module(live)
    a = live.assessment
    return CropReport(
        farm_id=farm_id,
        generated_at=now,
        score=a.score,
        level=a.level,
        status=a.status,
        headline=a.headline,
        explanation=a.explanation,
        confidence=a.confidence,
        factors=module.factors,
        indicators=module.indicators,
        trend=live.trend,
        advice=crop_recommendations(live),
    )
