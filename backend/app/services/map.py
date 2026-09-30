"""Builds the map overview: risk grid layers plus the farms that sit on them.

In live mode the flood layer is computed per cell by the flood engine (see
app/risk/flood_grid.py); other layers stay demo surfaces until their engines land.
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


async def build_map_overview(data_mode: str, now: datetime | None = None, pipeline=None) -> MapOverview:
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
    if data_mode == "live" and pipeline is not None:
        from app.pipeline import farm_locations
        from app.risk.flood_grid import live_flood_grid

        try:
            today = (now.astimezone(UTC) + timedelta(hours=6)).date()
            live = await asyncio.wait_for(live_flood_grid(pipeline, farm_locations(), today), LIVE_GRID_TIMEOUT_S)
        except Exception as error:  # keep the demo surface rather than failing the map
            log.warning("Live flood grid unavailable: %s", error)
        else:
            cells = [c.model_copy(update={"flood_risk": live[(c.lat, c.lon)]}) if (c.lat, c.lon) in live else c for c in cells]
            layers[0] = layers[0].model_copy(
                update={"live": True, "sources": ["GPM · Forecast", "SMAP", "SRTM", "POWER"],
                        "description": "Live: rain around today, soil saturation, land height and how unusual the week is."}
            )

    return MapOverview(
        generated_at=now,
        data_mode=data_mode,
        cell_size_deg=CELL_SIZE_DEG,
        bbox=BBOX,
        layers=layers,
        cells=cells,
        farms=farms,
    )
