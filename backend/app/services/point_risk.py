"""On-demand risk for any spot on Earth: the global map's "tap anywhere".

Bangladesh has a ready-made 0.2° risk grid. Everywhere else a farmer taps a spot and we run
the same flood, water and crop engines for that one point, from the sources that answer in
seconds (NASA POWER, the weather forecast, SRTM terrain, POWER climatology). The satellite
sources (SMAP, GPM, MODIS, VIIRS) start downloading in the background, so a second look
a few minutes later uses them too. Nearby taps share one cached ~5 km point.
"""

import asyncio
import logging
import time
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime, timedelta

import httpx2

from app.pipeline.http import get
from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.pipeline.sources.base import SourceError
from app.risk.grid import in_bangladesh
from app.schemas.dashboard import OverallCondition
from app.schemas.map import PointRisk
from app.services.custom_farms import ensure_location_data, satellites_pending
from app.services.dashboard import PRIORITY_ORDER
from app.services.risk import overall_score, overall_summary, score_to_level

log = logging.getLogger("farmshield.point")

SNAP_DEG = 0.05  # ~5 km: taps this close share one download
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
# Nominatim's usage policy: identify the app, at most one request per second, cache results.
USER_AGENT = "FarmShield-AI/1.0 (NASA Space Apps Challenge; https://github.com/aqshanto/FarmShield-AI)"
GEOCODE_TTL = timedelta(days=30)
# A name is nice to have, never worth a long wait: give up quickly, and after a failure skip
# the lookup for a while so every tap stays fast (the risk check doesn't need the name).
GEOCODE_TIMEOUT_S = 5
GEOCODE_PAUSE = timedelta(minutes=10)
MAX_LAT, MIN_LAT = 75.0, -60.0  # beyond this there is no farmland (and GPM stops at ±60°)
# Crops by their plain name (Bangladesh's season names like "Boro rice" don't travel);
# each maps to the same engine profile as at home.
WORLD_CROPS = {c: c.capitalize() for c in ("rice", "wheat", "maize", "potato", "tomato", "lentil", "mustard", "jute")}


class PointRiskError(ValueError):
    """The spot can't be checked (unknown crop, polar latitude)."""


class PointDataPendingError(RuntimeError):
    """The quick sources didn't answer in time; try again shortly."""


@dataclass(frozen=True)
class Place:
    name: str | None
    country: str | None
    land: bool


def snap(value: float) -> float:
    return round(round(value / SNAP_DEG) * SNAP_DEG, 2)


def point_location(lat: float, lon: float) -> Location:
    lat, lon = snap(lat), snap(lon)
    return Location(f"pt_{lat:.2f}_{lon:.2f}", lat, lon)


def local_today(now: datetime, lon: float) -> date:
    """The calendar day at that longitude (solar time is close enough for daily weather)."""
    return (now.astimezone(UTC) + timedelta(hours=round(lon / 15))).date()


# --- place names ---------------------------------------------------------------------------

_geocode_lock = asyncio.Lock()
_last_geocode = 0.0
_geocode_paused_until: datetime | None = None


def _pick_name(address: dict) -> str | None:
    for key in ("village", "town", "city", "municipality", "county", "state_district", "state", "region"):
        if address.get(key):
            return address[key]
    return None


async def reverse_geocode(pipeline: PipelineService, lat: float, lon: float, lang: str) -> Place | None:
    """Nearest named place and country from OpenStreetMap (in Bengali where OSM has it).

    Open water has no address, which is how we tell sea from land. None when the service
    can't be reached: the risk check still runs, just without a name.
    """
    global _last_geocode, _geocode_paused_until
    location = point_location(lat, lon)
    key = f"geocode:{location.id}:{lang}"
    hit = pipeline.store.cache_get(key)
    if hit and pipeline.now() - hit[1] < GEOCODE_TTL:
        return Place(**hit[0])  # type: ignore[arg-type]
    if _geocode_paused_until and pipeline.now() < _geocode_paused_until:
        return None

    async def lookup():
        global _last_geocode
        async with _geocode_lock:
            wait = 1.1 - (time.monotonic() - _last_geocode)
            if wait > 0:
                await asyncio.sleep(wait)
            async with pipeline.client_factory() as client:
                response = await get(
                    client,
                    NOMINATIM_URL,
                    params={"format": "jsonv2", "lat": location.lat, "lon": location.lon, "zoom": 10, "accept-language": f"{lang},en"},
                    headers={"User-Agent": USER_AGENT},
                    retries=0,
                )
            _last_geocode = time.monotonic()
        return response.json()

    try:
        payload = await asyncio.wait_for(lookup(), GEOCODE_TIMEOUT_S)
    except (SourceError, httpx2.HTTPError, ValueError, OSError, TimeoutError) as error:
        log.warning("Reverse geocoding failed for %s: %s", location.id, error or type(error).__name__)
        _geocode_paused_until = pipeline.now() + GEOCODE_PAUSE
        return None
    address = payload.get("address") if isinstance(payload, dict) else None
    place = Place(_pick_name(address), address.get("country"), True) if address else Place(None, None, False)
    pipeline.store.cache_set(key, asdict(place), pipeline.now())
    return place


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
