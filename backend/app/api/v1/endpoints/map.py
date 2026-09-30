from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.schemas.map import MapOverview
from app.services.map import build_map_overview

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/overview", response_model=MapOverview)
async def overview(
    settings: Settings = Depends(get_settings), pipeline: PipelineService = Depends(get_pipeline)
) -> MapOverview:
    return await build_map_overview(data_mode=settings.data_mode, pipeline=pipeline)
