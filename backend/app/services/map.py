"""Builds the map overview: risk grid layers plus the farms that sit on them.

In live mode all three layers are computed per cell by their engines (see app/risk/grid.py).
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from app.data.sample.farms import SAMPLE_FARMS
from app.data.sample.grid import BBOX, CELL_SIZE_DEG, cell_centres, risk_surface
from app.schemas.map import GridCell, MapFarm, MapLayer, MapOverview, ModuleLevel
from app.services.dashboard import build_dashboard

log = logging.getLogger("farmshield.map")
LIVE_GRID_TIMEOUT_S = 30
# Built in the background (nobody waiting), the grid may take longer: e.g. right after a
# restart on a small server, when terrain, weather and SMAP all download at once.
BACKGROUND_GRID_TIMEOUT_S = 120
# A built live map is served from memory: fresh for 30 minutes, then served once more while
# a new one builds in the background. A failed build is retried sooner.
OVERVIEW_FRESH = timedelta(minutes=30)
FAILED_OVERVIEW_FRESH = timedelta(minutes=5)
# A cold visit waits this long for a running build before getting the modelled map.
COLD_WAIT_S = 3.0
# After the live grid fails, serve the modelled surface at once for a while instead of
# making every map visitor wait for the same failure.
LIVE_GRID_RETRY_AFTER = timedelta(minutes=10)
_grid_failed: tuple[datetime, str] | None = None

LAYERS = [
    MapLayer(
        id="flood_risk",
        title="Flood risk",
        description="Where heavy rain and soaked soil could flood fields.",
        sources=["GPM", "SMAP"],
    ),
    MapLayer(
        id="water_stress",
        title="Water stress",
        description="Where soil is drying out and crops need water.",
        sources=["SMAP", "GPM", "MODIS"],
    ),
    MapLayer(
        id="crop_health",
        title="Crop health",
        description="Where plants look stressed from space.",
        sources=["MODIS", "VIIRS"],
    ),
]


async def build_map_overview(
    data_mode: str, now: datetime | None = None, pipeline=None, grid_timeout: float = LIVE_GRID_TIMEOUT_S
) -> MapOverview:
    now = now or datetime.now(UTC)
    dashboards = [build_dashboard(farm_id, data_mode=data_mode, now=now, pipeline=pipeline) for farm_id in SAMPLE_FARMS]

    farms = [
        MapFarm(
            id=d.farm.id,
            name=d.farm.name,
            district=d.farm.district,
            crop=d.farm.crop,
            lat=d.farm.lat,
            lon=d.farm.lon,
            overall=d.overall,
            modules={m.id: ModuleLevel(score=m.score, level=m.level) for m in d.modules},
        )
        for d in dashboards
    ]

    surfaces = {
        layer.id: risk_surface(layer.id, anchors=[(f.lat, f.lon, f.modules[layer.id].score) for f in farms])
        for layer in LAYERS
    }
    cells = [
        GridCell(
            lat=lat,
            lon=lon,
            flood_risk=surfaces["flood_risk"](lat, lon),
            water_stress=surfaces["water_stress"](lat, lon),
            crop_health=surfaces["crop_health"](lat, lon),
        )
        for lat, lon in cell_centres()
    ]

    layers = [layer.model_copy() for layer in LAYERS]
    grid_status = "demo"
    global _grid_failed
    if data_mode == "live" and pipeline is not None and _grid_failed and now - _grid_failed[0] < LIVE_GRID_RETRY_AFTER:
        grid_status = _grid_failed[1]
    elif data_mode == "live" and pipeline is not None:
        from app.pipeline import farm_locations
        from app.risk.grid import live_grid

        try:
            today = (now.astimezone(UTC) + timedelta(hours=6)).date()
            live = await asyncio.wait_for(live_grid(pipeline, farm_locations(), today), grid_timeout)
        except Exception as error:  # keep the demo surface rather than failing the map
            reason = f"{type(error).__name__}: {error}"[:200] if str(error) else type(error).__name__
            log.warning("Live flood grid unavailable: %s", reason)
            _grid_failed = (now, reason)
            grid_status = reason
        else:
            _grid_failed = None
            weather = pipeline.store.cache_get("grid_weather_v3")
            backup = weather and weather[0].get("past_source") == "nasa_power"
            grid_status = "live (weather: NASA POWER + MET Norway)" if backup else "live"
            cells = [c.model_copy(update=live[(c.lat, c.lon)]) if (c.lat, c.lon) in live else c for c in cells]
            layers[0] = layers[0].model_copy(
                update={"live": True, "sources": ["GPM · Forecast", "SMAP", "SRTM", "POWER"],
                        "description": "Live: rain around today, soil saturation, land height and how unusual the week is."}
            )
            layers[1] = layers[1].model_copy(
                update={"live": True, "sources": ["SMAP", "POWER", "Forecast"],
                        "description": "Live: how dry the topsoil is, the 30-day rain shortfall, heat and coming rain."}
            )
            layers[2] = layers[2].model_copy(
                update={"live": True, "sources": ["SMAP", "POWER", "Forecast"],
                        "description": "Live: crop stress from heat, disease weather, water and waterlogging (rice). Greenness is checked at farms."}
            )

    return MapOverview(
        generated_at=now,
        data_mode=data_mode,
        cell_size_deg=CELL_SIZE_DEG,
        bbox=BBOX,
        layers=layers,
        cells=cells,
        farms=farms,
        grid_status=grid_status,
    )


# --- served map: cached, built once at a time, never a long wait --------------------------------

# Per pipeline (tests use their own): (built at, overview).
_cache: dict[int, tuple[datetime, MapOverview]] = {}
_building: dict[int, asyncio.Task] = {}


def warm_map_overview(pipeline) -> asyncio.Task:
    """Build the live map in the background (joins a build that's already running)."""
    key = id(pipeline)
    task = _building.get(key)
    if task is None or task.done():
        task = asyncio.create_task(_build_and_store(pipeline))
        _building[key] = task
    return task


async def _build_and_store(pipeline) -> MapOverview:
    try:
        overview = await build_map_overview("live", pipeline=pipeline, grid_timeout=BACKGROUND_GRID_TIMEOUT_S)
    except Exception:
        log.exception("Building the map failed")
        raise
    _cache[id(pipeline)] = (datetime.now(UTC), overview)
    log.info("Map ready: %s", overview.grid_status)
    return overview


async def get_map_overview(data_mode: str, pipeline=None) -> MapOverview:
    """What the API serves. The demo map is cheap and built per request; the live one comes
    from memory, is rebuilt in the background when it's old, and a visitor who arrives before
    the first build finishes gets the modelled map at once, marked "warming", instead of a
    long wait (the page asks again shortly)."""
    if data_mode != "live" or pipeline is None:
        return await build_map_overview(data_mode, pipeline=pipeline)
    hit = _cache.get(id(pipeline))
    if hit:
        built_at, overview = hit
        fresh_for = OVERVIEW_FRESH if overview.grid_status.startswith("live") else FAILED_OVERVIEW_FRESH
        if datetime.now(UTC) - built_at >= fresh_for:
            warm_map_overview(pipeline)  # serve this one meanwhile
        return overview
    task = warm_map_overview(pipeline)
    try:
        return await asyncio.wait_for(asyncio.shield(task), COLD_WAIT_S)
    except Exception:  # still building (timeout), or the build failed: don't make the visitor wait
        warming = await build_map_overview("live", pipeline=None)
        return warming.model_copy(update={"grid_status": "warming"})


def reset_map_cache() -> None:
    """For tests: forget built maps."""
    _cache.clear()
    _building.clear()
