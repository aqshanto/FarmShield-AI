import asyncio
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings
from app.pipeline import farm_locations, get_pipeline
from app.pipeline.service import PipelineService
from app.schemas.data import DataStatus, FarmObservations, ObservationPoint, RefreshStarted, VariableSeries

router = APIRouter(tags=["data"])

# Keep references to background refreshes so they aren't garbage-collected mid-run.
_background: set[asyncio.Task] = set()


def start_background_refresh(pipeline: PipelineService, days: int, force: bool = False) -> bool:
    if pipeline.refreshing:
        return False
    task = asyncio.create_task(pipeline.refresh(farm_locations(), days=days, force=force))
    _background.add(task)
    task.add_done_callback(_background.discard)
    return True


@router.get("/data/status", response_model=DataStatus)
async def data_status(
    pipeline: PipelineService = Depends(get_pipeline), settings: Settings = Depends(get_settings)
) -> DataStatus:
    return DataStatus(
        token_configured=bool(settings.earthdata_token),
        refreshing=pipeline.refreshing,
        sources=pipeline.source_status(),
        missions=await pipeline.mission_freshness(),
    )


@router.post("/data/refresh", response_model=RefreshStarted, status_code=202)
async def refresh(
    force: bool = False,
    pipeline: PipelineService = Depends(get_pipeline),
    settings: Settings = Depends(get_settings),
) -> RefreshStarted:
    if start_background_refresh(pipeline, settings.pipeline_days, force):
        return RefreshStarted(started=True, message="Downloading the latest NASA data for every farm.")
    return RefreshStarted(started=False, message="A refresh is already running.")


@router.get("/farms/{farm_id}/observations", response_model=FarmObservations)
def farm_observations(
    farm_id: str,
    days: int = Query(60, ge=7, le=365),
    pipeline: PipelineService = Depends(get_pipeline),
) -> FarmObservations:
    location = next((loc for loc in farm_locations() if loc.id == farm_id), None)
    if location is None:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found")

    variables = []
    for series in pipeline.observations(location, days):
        points = [ObservationPoint(date=p.date, value=p.value, source=p.source, quality=p.quality) for p in series.points]
        variables.append(
            VariableSeries(
                id=series.id,
                label=series.label,
                unit=series.unit,
                description=series.description,
                sources_used=series.sources_used,
                points=points,
                latest=points[-1] if points else None,
            )
        )
    return FarmObservations(farm_id=farm_id, generated_at=datetime.now(UTC), days=days, variables=variables)
