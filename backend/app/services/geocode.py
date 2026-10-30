"""Place names anywhere on Earth, from OpenStreetMap: Nominatim, with Photon as backup.

Used for spot checks on the map, farms outside Bangladesh, and the "find my village" search.
Nominatim's usage policy: identify the app, at most one request per second, cache results.
A name is nice to have, never worth a long wait: lookups give up after a few seconds, and
after a failure they're skipped for a while so taps stay fast. Nominatim refuses some cloud
server addresses outright, so Photon (komoot's OpenStreetMap geocoder, no key) answers then.
"""

import asyncio
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

import httpx2

from app.pipeline.http import get
from app.pipeline.service import PipelineService
from app.pipeline.sources.base import SourceError

log = logging.getLogger("farmshield.geocode")

REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
SEARCH_URL = "https://nominatim.openstreetmap.org/search"
PHOTON_SEARCH_URL = "https://photon.komoot.io/api/"
PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse"
# Photon only searches these kinds of places, so "Giza" finds the city, not a shop.
PHOTON_LAYERS = ["city", "district", "county", "state", "locality"]
USER_AGENT = "FarmShield-AI/1.0 (NASA Space Apps Challenge; https://github.com/aqshanto/FarmShield-AI)"
GEOCODE_TTL = timedelta(days=30)
GEOCODE_TIMEOUT_S = 5
GEOCODE_PAUSE = timedelta(minutes=10)
SNAP_DEG = 0.05  # ~5 km: nearby points share one cached name

_geocode_lock = asyncio.Lock()
_last_geocode = 0.0
_geocode_paused_until: datetime | None = None
_photon_paused_until: datetime | None = None


@dataclass(frozen=True)
class Place:
    name: str | None
    country: str | None
    land: bool


@dataclass(frozen=True)
class FoundPlace:
    name: str
    detail: str  # region and country, to tell same-named places apart
    country: str | None
    lat: float
    lon: float


def snap(value: float) -> float:
    return round(round(value / SNAP_DEG) * SNAP_DEG, 2)


def _pick_name(address: dict) -> str | None:
    for key in ("village", "town", "city", "municipality", "county", "state_district", "state", "region"):
        if address.get(key):
            return address[key]
    return None


async def _nominatim(pipeline: PipelineService, url: str, params: dict):
    """One polite Nominatim request: ≤1/s, a few seconds at most, paused after a failure."""
    global _last_geocode, _geocode_paused_until
    if _geocode_paused_until and pipeline.now() < _geocode_paused_until:
        return None

    async def call():
        global _last_geocode
        async with _geocode_lock:
            wait = 1.1 - (time.monotonic() - _last_geocode)
            if wait > 0:
                await asyncio.sleep(wait)
            async with pipeline.client_factory() as client:
                response = await get(client, url, params=params, headers={"User-Agent": USER_AGENT}, retries=0)
            _last_geocode = time.monotonic()
        return response.json()

    try:
        return await asyncio.wait_for(call(), GEOCODE_TIMEOUT_S)
    except (SourceError, httpx2.HTTPError, ValueError, OSError, TimeoutError) as error:
        log.warning("Nominatim failed (%s): %s", url.rsplit("/", 1)[-1], error or type(error).__name__)
        _geocode_paused_until = pipeline.now() + GEOCODE_PAUSE
        return None


async def _photon(pipeline: PipelineService, url: str, params: dict):
    """The backup service: same budget and pause rules as Nominatim."""
    global _photon_paused_until
    if _photon_paused_until and pipeline.now() < _photon_paused_until:
        return None

    async def call():
        async with pipeline.client_factory() as client:
            response = await get(client, url, params=params, headers={"User-Agent": USER_AGENT}, retries=0)
        return response.json()

    try:
        return await asyncio.wait_for(call(), GEOCODE_TIMEOUT_S)
    except (SourceError, httpx2.HTTPError, ValueError, OSError, TimeoutError) as error:
        log.warning("Photon failed: %s", error or type(error).__name__)
        _photon_paused_until = pipeline.now() + GEOCODE_PAUSE
        return None


def _photon_lang(lang: str) -> dict:
    # Photon speaks a few languages (no Bengali); without one it gives local names, which in
    # Bangladesh are Bengali.
    return {"lang": "en"} if lang == "en" else {}


def _photon_place(payload) -> Place | None:
    features = payload.get("features") if isinstance(payload, dict) else None
    if not features:
        return None  # Photon finds no nearest place at sea or in remote areas: unknown, not water
    props = features[0].get("properties", {})
    name = props.get("city") or props.get("town") or props.get("village") or props.get("county") or props.get("name") or props.get("state")
    return Place(name, props.get("country"), True)


async def reverse_geocode(pipeline: PipelineService, lat: float, lon: float, lang: str) -> Place | None:
    """Nearest named place and country (in Bengali where OSM has it). Open water has no
    address, which is how we tell sea from land. None when the service can't be reached."""
    lat, lon = snap(lat), snap(lon)
    key = f"geocode:pt_{lat:.2f}_{lon:.2f}:{lang}"
    hit = pipeline.store.cache_get(key)
    if hit and pipeline.now() - hit[1] < GEOCODE_TTL:
        return Place(**hit[0])  # type: ignore[arg-type]
    payload = await _nominatim(pipeline, REVERSE_URL, {"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 10, "accept-language": f"{lang},en"})
    if payload is None:
        backup = await _photon(pipeline, PHOTON_REVERSE_URL, {"lat": lat, "lon": lon, **_photon_lang(lang)})
        place = _photon_place(backup) if backup is not None else None
        if place is not None:
            pipeline.store.cache_set(key, asdict(place), pipeline.now())
        return place
    address = payload.get("address") if isinstance(payload, dict) else None
    place = Place(_pick_name(address), address.get("country"), True) if address else Place(None, None, False)
    pipeline.store.cache_set(key, asdict(place), pipeline.now())
    return place


async def search_places(pipeline: PipelineService, query: str, lang: str, limit: int = 5) -> list[FoundPlace] | None:
    """Villages, towns and regions matching what the farmer typed. None if the service is down."""
    query = " ".join(query.split())[:100]
    key = f"search:{query.lower()}:{lang}"
    hit = pipeline.store.cache_get(key)
    if hit and pipeline.now() - hit[1] < GEOCODE_TTL:
        return [FoundPlace(**p) for p in hit[0]]  # type: ignore[union-attr]
    payload = await _nominatim(
        pipeline, SEARCH_URL, {"format": "jsonv2", "q": query, "limit": limit, "addressdetails": 1, "accept-language": f"{lang},en"}
    )
    if payload is None:
        backup = await _photon(pipeline, PHOTON_SEARCH_URL, [("q", query), ("limit", limit), *(("layer", x) for x in PHOTON_LAYERS), *_photon_lang(lang).items()])
        if backup is None:
            return None
        found = _photon_found(backup)
        pipeline.store.cache_set(key, [asdict(p) for p in found], pipeline.now())
        return found
    found = []
    for item in payload if isinstance(payload, list) else []:
        try:
            address = item.get("address", {})
            name = item.get("name") or _pick_name(address) or item["display_name"].split(",")[0]
            region = address.get("state") or address.get("county") or address.get("state_district")
            detail = ", ".join(x for x in (region, address.get("country")) if x and x != name)
            found.append(FoundPlace(name, detail, address.get("country"), round(float(item["lat"]), 5), round(float(item["lon"]), 5)))
        except (KeyError, TypeError, ValueError):
            continue
    pipeline.store.cache_set(key, [asdict(p) for p in found], pipeline.now())
    return found


def _photon_found(payload) -> list[FoundPlace]:
    found = []
    for feature in payload.get("features", []) if isinstance(payload, dict) else []:
        try:
            props = feature["properties"]
            lon, lat = feature["geometry"]["coordinates"][:2]
            name = props["name"]
            detail = ", ".join(x for x in (props.get("state") or props.get("county"), props.get("country")) if x and x != name)
            found.append(FoundPlace(name, detail, props.get("country"), round(float(lat), 5), round(float(lon), 5)))
        except (KeyError, TypeError, ValueError):
            continue
    return found
