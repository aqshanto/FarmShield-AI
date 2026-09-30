from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from datetime import UTC, datetime, timedelta

from app.pipeline import farm_locations
from app.risk.live import flood_recommendations, live_flood, SOURCE_NAMES
from app.schemas.dashboard import Dashboard, FarmSummary, RiskFactor
from app.schemas.flood import FloodInputsOut, FloodReport, RainDay
from app.services.dashboard import FarmNotFoundError, build_dashboard, list_farms

router = APIRouter(prefix="/farms", tags=["farms"])


@router.get("", response_model=list[FarmSummary])
def farms() -> list[FarmSummary]:
    return list_farms()


@router.get("/{farm_id}/dashboard", response_model=Dashboard)
def dashboard(
    farm_id: str, settings: Settings = Depends(get_settings), pipeline: PipelineService = Depends(get_pipeline)
) -> Dashboard:
    try:
        return build_dashboard(farm_id, data_mode=settings.data_mode, pipeline=pipeline)
    except FarmNotFoundError:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found") from None


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
