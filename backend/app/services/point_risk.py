"""On-demand risk for any spot on Earth: the global map's "tap anywhere".

Bangladesh has a ready-made 0.2° risk grid. Everywhere else a farmer taps a spot and we run
the same flood, water and crop engines for that one point, from the sources that answer in
seconds (NASA POWER, the weather forecast, SRTM terrain, POWER climatology). The satellite
sources (SMAP, GPM, MODIS, VIIRS) start downloading in the background, so a second look
a few minutes later uses them too. Nearby taps share one cached ~5 km point.
"""

import asyncio
import logging
from datetime import UTC, date, datetime

from app.data.crops import WORLD_CROPS as WORLD_CROP_LIST
from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.risk.region import in_bangladesh, local_today
from app.schemas.dashboard import OverallCondition
from app.schemas.map import PointRisk
from app.services.custom_farms import ensure_location_data, satellites_pending
from app.services.dashboard import PRIORITY_ORDER
from app.services.geocode import Place, reverse_geocode, snap  # noqa: F401  (Place: re-exported for callers)
from app.services.risk import overall_score, overall_summary, score_to_level

log = logging.getLogger("farmshield.point")

MAX_LAT, MIN_LAT = 75.0, -60.0  # beyond this there is no farmland (and GPM stops at ±60°)
# Crops by their plain name (Bangladesh's season names like "Boro rice" don't travel);
# each maps to the same engine profile as at home.
WORLD_CROPS = {c.id: c.name for c in WORLD_CROP_LIST}


class PointRiskError(ValueError):
    """The spot can't be checked (unknown crop, polar latitude)."""


class PointDataPendingError(RuntimeError):
    """The quick sources didn't answer in time; try again shortly."""


def point_location(lat: float, lon: float) -> Location:
    lat, lon = snap(lat), snap(lon)
    return Location(f"pt_{lat:.2f}_{lon:.2f}", lat, lon)


# --- risk --------------------------------------------------------------------------------------


def _assess(pipeline: PipelineService, location: Location, today: date, crop: str):
    """The live engines for one point (runs in a worker thread: SQLite and arithmetic)."""
    from app.risk.live import (
        crop_module,
        crop_recommendations,
        flood_module,
        flood_recommendations,
        live_crop,
        live_flood,
        live_water,
        water_module,
        water_recommendations,
    )

    flood = live_flood(pipeline, location, today)
    water = live_water(pipeline, location, today)
    crop_live = live_crop(pipeline, location, today, crop, water=water, flood=flood)
    if flood is None or water is None or crop_live is None:
        return None
    modules = [flood_module(flood), water_module(water), crop_module(crop_live)]
    recommendations = flood_recommendations(flood) + water_recommendations(water) + crop_recommendations(crop_live)
    return modules, sorted(recommendations, key=lambda r: PRIORITY_ORDER[r.priority])[:3]


async def point_risk(
    pipeline: PipelineService,
    lat: float,
    lon: float,
    crop: str = "rice",
    lang: str = "en",
    now: datetime | None = None,
    geocode=reverse_geocode,
) -> PointRisk:
    if crop not in WORLD_CROPS:
        raise PointRiskError(f"Unknown crop '{crop}'.")
    if not MIN_LAT <= lat <= MAX_LAT:
        raise PointRiskError("There is no farmland this close to the poles.")
    lon = ((lon + 180) % 360) - 180  # the map can wrap around the world
    now = now or datetime.now(UTC)
    location = point_location(lat, lon)

    place = await geocode(pipeline, lat, lon, lang)
    base = {"lat": location.lat, "lon": location.lon, "crop": WORLD_CROPS[crop], "in_bangladesh": in_bangladesh(lat, lon)}
    if place and not place.land:
        return PointRisk(**base, place=None, country=None, land=False)

    await ensure_location_data(pipeline, location)
    result = await asyncio.to_thread(_assess, pipeline, location, local_today(now, lon), WORLD_CROPS[crop])
    if result is None:
        raise PointDataPendingError(location.id)
    modules, recommendations = result
    worst = max(modules, key=lambda m: m.score)
    level = score_to_level(overall_score([m.score for m in modules]))
    return PointRisk(
        **base,
        place=place.name if place else None,
        country=place.country if place else None,
        land=True,
        overall=OverallCondition(score=overall_score([m.score for m in modules]), level=level, summary=overall_summary(level, worst.id)),
        modules=modules,
        recommendations=recommendations,
        satellites_pending=satellites_pending(location),
    )
