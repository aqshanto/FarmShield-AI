"""Farms that farmers add themselves: any field on Earth, any supported crop.

In Bangladesh a field is described by its district and division and uses the Bangladeshi
crop list (with season names); elsewhere by the nearest named place and country (looked up
when the dashboard is built, in the farmer's language) and plain crop names.

A custom farm is fully described by its id, `my_<lat>_<lon>_<crop>`, so the server keeps
no per-user state (farmers' saved fields live in their own browser). NASA data is cached
per ~1 km point, shared by everyone farming nearby.
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.data.crops import CROPS_BY_ID, WORLD_CROPS_BY_ID, Crop
from app.data.places import DIVISIONS, Place, nearest_district
from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.risk.region import in_bangladesh

log = logging.getLogger(__name__)

FARM_ID = re.compile(r"^my_(-?\d{1,2}\.\d{1,6})_(-?\d{1,3}\.\d{1,6})_([a-z-]+)$")
MAX_LAT, MIN_LAT = 75.0, -60.0  # no farmland beyond (and GPM stops at ±60°)
# Quick sources answer a new field in seconds; the rest fill in over the next minutes.
FAST_SOURCES = ["nasa_power", "open_meteo", "srtm", "power_climatology"]
SLOW_SOURCES = ["modis", "viirs", "gpm_imerg", "smap"]


class CustomFarmError(ValueError):
    """The id isn't a valid custom farm (bad format, unknown crop, polar latitude)."""


@dataclass(frozen=True)
class CustomFarm:
    id: str
    lat: float
    lon: float
    crop: Crop
    # Bangladesh only; elsewhere the place is named from OpenStreetMap at dashboard time.
    district: Place | None
    division: Place | None

    @property
    def in_bangladesh(self) -> bool:
        return self.district is not None

    @property
    def location(self) -> Location:
        # ~1 km grid: nearby fields share one cached download.
        return Location(f"pt_{self.lat:.2f}_{self.lon:.2f}", round(self.lat, 2), round(self.lon, 2))


def is_custom_id(farm_id: str) -> bool:
    return farm_id.startswith("my_")


def make_farm_id(lat: float, lon: float, crop_id: str) -> str:
    return f"my_{lat:.4f}_{lon:.4f}_{crop_id}"


def describe_point(lat: float, lon: float) -> tuple[Place, Place, float]:
    district, km = nearest_district(lat, lon)
    return district, DIVISIONS[district.division], km


def parse_farm_id(farm_id: str) -> CustomFarm:
    match = FARM_ID.match(farm_id)
    if not match:
        raise CustomFarmError("Not a valid farm id.")
    lat, lon, crop_id = float(match[1]), float(match[2]), match[3]
    if not (MIN_LAT <= lat <= MAX_LAT and -180 <= lon <= 180):
        raise CustomFarmError("There is no farmland this close to the poles.")
    if in_bangladesh(lat, lon):
        crop = CROPS_BY_ID.get(crop_id)
        if crop is None:
            raise CustomFarmError(f"Unknown crop '{crop_id}'.")
        district, division, _ = describe_point(lat, lon)
        return CustomFarm(farm_id, lat, lon, crop, district, division)
    crop = WORLD_CROPS_BY_ID.get(crop_id)
    if crop is None:
        raise CustomFarmError(f"Unknown crop '{crop_id}'.")
    return CustomFarm(farm_id, lat, lon, crop, None, None)


# --- data ----------------------------------------------------------------------------------

_background: dict[str, asyncio.Task] = {}


async def ensure_data(pipeline: PipelineService, farm: CustomFarm, days: int = 60) -> None:
    """Fetch the quick sources now (skipped when fresh) and start the slow ones in the background."""
    await ensure_location_data(pipeline, farm.location, days)


async def ensure_location_data(pipeline: PipelineService, location: Location, days: int = 60) -> None:
    """Same for any point on Earth (also used by the global map's point check)."""
    await pipeline.refresh_location(location, FAST_SOURCES, days)
    running = _background.get(location.id)
    if running is None or running.done():
        _background[location.id] = asyncio.create_task(_fetch_slow(pipeline, location, days))


def satellites_pending(location: Location) -> bool:
    """True while SMAP, GPM, MODIS and VIIRS are still downloading for this point."""
    running = _background.get(location.id)
    return running is not None and not running.done()


async def _fetch_slow(pipeline: PipelineService, location: Location, days: int) -> None:
    try:
        results = await pipeline.refresh_location(location, SLOW_SOURCES, days)
        log.info("Field %s satellite data: %s", location.id, {r.source: r.status for r in results})
    except Exception:  # background work must never crash the server
        log.exception("Background fetch failed for %s", location.id)


def last_data_time(pipeline: PipelineService, farm: CustomFarm, now: datetime) -> datetime:
    """When NASA data for this field was last fetched (for "satellite pass … ago")."""
    times = [r.finished_at for s in FAST_SOURCES + SLOW_SOURCES if (r := pipeline.store.last_fetch(s, farm.location.id, status="ok"))]
    latest = max(times, default=now - timedelta(hours=1))
    return latest if latest.tzinfo else latest.replace(tzinfo=UTC)
