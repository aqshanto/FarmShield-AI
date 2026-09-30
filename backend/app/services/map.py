"""Builds the map overview: risk grid layers plus the farms that sit on them."""

from datetime import UTC, datetime

from app.data.sample.farms import SAMPLE_FARMS
from app.data.sample.grid import BBOX, CELL_SIZE_DEG, cell_centres, risk_surface
from app.schemas.map import GridCell, MapFarm, MapLayer, MapOverview, ModuleLevel
from app.services.dashboard import build_dashboard

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


def build_map_overview(data_mode: str, now: datetime | None = None) -> MapOverview:
    now = now or datetime.now(UTC)
    dashboards = [build_dashboard(farm_id, data_mode=data_mode, now=now) for farm_id in SAMPLE_FARMS]

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

    return MapOverview(
        generated_at=now,
        data_mode=data_mode,
        cell_size_deg=CELL_SIZE_DEG,
        bbox=BBOX,
        layers=LAYERS,
        cells=cells,
        farms=farms,
    )
