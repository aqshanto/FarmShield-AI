"""One way to load any farm's dashboard: the demo farms or a farmer's own field."""

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

from app.pipeline.service import PipelineService
from app.schemas.dashboard import Dashboard
from app.services.custom_farms import CustomFarmError, ensure_data, is_custom_id, parse_farm_id
from app.services.dashboard import FarmDataPendingError, FarmNotFoundError, build_custom_dashboard, build_dashboard


async def load_dashboard(farm_id: str, data_mode: str, pipeline: PipelineService, name: str | None = None) -> Dashboard:
    """Raises HTTPException with a farmer-friendly message when the farm can't be shown."""
    if is_custom_id(farm_id):
        try:
            farm = parse_farm_id(farm_id)
        except CustomFarmError as error:
            raise HTTPException(status_code=404, detail=str(error)) from None
        if data_mode != "live":
            raise HTTPException(status_code=409, detail="Your own farms need live NASA data, and the server is running the demo scenario.")
        await ensure_data(pipeline, farm)
        try:
            # SQLite reads and the risk engines: keep them off the event loop.
            return await run_in_threadpool(build_custom_dashboard, farm, pipeline, name)
        except FarmDataPendingError:
            raise HTTPException(status_code=503, detail="Still downloading NASA data for this field. Try again in a moment.") from None
    try:
        return await run_in_threadpool(build_dashboard, farm_id, data_mode, None, pipeline)
    except FarmNotFoundError:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found") from None
