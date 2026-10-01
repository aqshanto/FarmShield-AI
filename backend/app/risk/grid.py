"""Live risk for every map cell over Bangladesh, using the same engines as the farms.

Per cell (0.2°, land only):
  terrain     NASA SRTM elevation (OpenTopoData, batched; cached for a year)
  weather     Open-Meteo daily rain, high/mean temperature and humidity, last 30 days + next 5, one
              multi-point request (cached 3 h)
  topsoil     SMAP SPL3SMP_E bounding-box subset for the last 3 days, newest valid pass
              per cell (cached 6 h). Without a token: the national NASA POWER wetness.
  normals     NASA POWER monthly normals, averaged over the farms

Flood uses terrain + rain + saturation + normal; water stress uses topsoil + rain
shortfall + heat + coming rain; crop health (rice profile, Bangladesh's main crop) uses
heat, disease weather and the cell's own flood and water scores. Root-zone wetness and
vegetation exist only at farms, so those factors drop out on the map (engines re-normalise).
"""

import asyncio
import json
import logging
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import fmean

import httpx2

from app.data.sample.grid import cell_centres
from app.pipeline.grids import M09_COLS, ease2_m09_index
from app.pipeline.http import get
from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.pipeline.sources.opendap import SmapSource, granule_links
from app.pipeline.sources.static import srtm_elevations
from app.risk.crop import CropInputs
from app.risk.crop import score_factors as crop_score
from app.risk.flood import DailyRain, FloodInputs
from app.risk.flood import score_factors as flood_score
from app.risk.inputs import POROSITY, flood_inputs, water_inputs
from app.risk.water import Reading, WaterInputs
from app.risk.water import score_factors as water_score

log = logging.getLogger("farmshield.grid")

OUTLINE = json.loads((Path(__file__).resolve().parent.parent / "data" / "bangladesh.geo.json").read_text())
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
RAIN_TTL = timedelta(hours=3)
SMAP_TTL = timedelta(hours=6)


def _in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_bangladesh(lat: float, lon: float) -> bool:
    geometry = OUTLINE["geometry"]
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    return any(_in_ring(lon, lat, outer) and not any(_in_ring(lon, lat, hole) for hole in holes) for outer, *holes in polygons)


def land_cells() -> list[tuple[float, float]]:
    return [c for c in cell_centres() if in_bangladesh(*c)]


# --- inputs, each cached in the pipeline store ------------------------------------------------


def _cached(pipeline: PipelineService, key: str, ttl: timedelta | None):
    hit = pipeline.store.cache_get(key)
    if hit and (ttl is None or pipeline.now() - hit[1] < ttl):
        return hit[0]
    return None


async def _elevations(pipeline: PipelineService, client: httpx2.AsyncClient, cells: list[tuple[float, float]]) -> list[float | None]:
    key = f"grid_elevation:{len(cells)}"
    cached = _cached(pipeline, key, ttl=None)
    if cached is not None:
        return cached
    values = await srtm_elevations(client, cells)
    pipeline.store.cache_set(key, values, pipeline.now())
    return values


async def _weather(pipeline: PipelineService, client: httpx2.AsyncClient, cells: list[tuple[float, float]]) -> dict:
    key = "grid_weather_v2"  # v2 adds humidity and mean temperature
    cached = _cached(pipeline, key, RAIN_TTL)
    if cached is not None:
        return cached
    days: list[str] = []
    rain_cells: list[list[float | None]] = []
    tmax_cells: list[list[float | None]] = []
    tmean_cells: list[list[float | None]] = []
    humid_cells: list[list[float | None]] = []
    for i in range(0, len(cells), 400):  # comfortably within Open-Meteo's multi-location limit
        batch = cells[i : i + 400]
        response = await get(
            client,
            FORECAST_URL,
            params={
                "latitude": ",".join(str(lat) for lat, _ in batch),
                "longitude": ",".join(str(lon) for _, lon in batch),
                "daily": "precipitation_sum,temperature_2m_max,temperature_2m_mean,relative_humidity_2m_mean",
                "past_days": 30,
                "forecast_days": 5,
                "timezone": "Asia/Dhaka",
            },
        )
        payload = response.json()
        for location in payload if isinstance(payload, list) else [payload]:
            days = location["daily"]["time"]
            rain_cells.append(location["daily"]["precipitation_sum"])
            tmax_cells.append(location["daily"]["temperature_2m_max"])
            tmean_cells.append(location["daily"]["temperature_2m_mean"])
            humid_cells.append(location["daily"]["relative_humidity_2m_mean"])
    value = {"days": days, "rain": rain_cells, "tmax": tmax_cells, "tmean": tmean_cells, "humidity": humid_cells}
    pipeline.store.cache_set(key, value, pipeline.now())
    return value


async def _smap(
    pipeline: PipelineService, client: httpx2.AsyncClient, cells: list[tuple[float, float]], today: date
) -> list[float | None] | None:
    token = next((getattr(s, "token", None) for s in pipeline.sources.values() if s.info.id == "smap"), None)
    if not token:
        return None
    key = "grid_smap"
    cached = _cached(pipeline, key, SMAP_TTL)
    if cached is not None:
        return cached

    indexes = [ease2_m09_index(lat, lon) for lat, lon in cells]
    r0, r1 = min(r for r, _ in indexes), max(r for r, _ in indexes)
    c0, c1 = min(c for _, c in indexes), min(M09_COLS - 1, max(c for _, c in indexes) + 1)
    centre = Location("bangladesh", 23.7, 90.3)
    links = await granule_links(client, SmapSource.collection, centre, today - timedelta(days=3), today)
    headers = {"Authorization": f"Bearer {token}"}
    best: list[float | None] = [None] * len(cells)
    # Newest pass first; older passes only fill cells the newer ones missed.
    for _day, url in sorted(links.items(), reverse=True):
        grid: dict[tuple[int, int], float] = {}
        for var in ("Soil_Moisture_Retrieval_Data_AM/soil_moisture", "Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm"):
            response = await get(client, f"{url}.dap.csv", params={"dap4.ce": f"/{var}[{r0}:{r1}][{c0}:{c1}]"}, headers=headers)
            for line in response.text.splitlines():
                head, _, tail = line.partition(",")
                if not tail or "[" not in head:
                    continue
                row = r0 + int(head[head.rindex("[") + 1 : head.rindex("]")])
                for j, raw in enumerate(tail.split(",")):
                    raw = raw.strip()
                    if raw:
                        value = float(raw)
                        if 0 <= value <= 0.7:
                            grid.setdefault((row, c0 + j), value)
        for k, (row, col) in enumerate(indexes):
            if best[k] is None and (row, col) in grid:
                best[k] = grid[(row, col)]
    pipeline.store.cache_set(key, best, pipeline.now())
    return best


# --- the grid ---------------------------------------------------------------------------------


async def live_grid(pipeline: PipelineService, farms: list[Location], today: date) -> dict[tuple[float, float], dict[str, int]]:
    """{"flood_risk", "water_stress", "crop_health"} scores for each land cell, keyed by (lat, lon) centre."""
    cells = land_cells()
    async with pipeline.client_factory() as client:
        elevations, weather = await asyncio.gather(_elevations(pipeline, client, cells), _weather(pipeline, client, cells))
        try:
            smap = await _smap(pipeline, client, cells, today)
        except Exception as error:  # topsoil falls back to the national value
            log.warning("SMAP grid subset failed: %s", error)
            smap = None

    farm_flood = [flood_inputs(pipeline, farm, today) for farm in farms]
    farm_water = [water_inputs(pipeline, farm, today) for farm in farms]
    saturations = [i.saturation for i in farm_flood if i.saturation is not None]
    national_saturation = fmean(saturations) if saturations else None
    normals: dict[int, float] = {}
    for month in range(1, 13):
        values = [w.normals[month] for w in farm_water if month in w.normals]
        if values:
            normals[month] = fmean(values)

    days = [datetime.strptime(d, "%Y-%m-%d").date() for d in weather["days"]]
    scores: dict[tuple[float, float], dict[str, int]] = {}
    for k, (lat, lon) in enumerate(cells):
        rain_row = weather["rain"][k] if k < len(weather["rain"]) else []
        tmax_row = weather["tmax"][k] if k < len(weather["tmax"]) else []
        daily = [DailyRain(d, mm, "open_meteo", d > today) for d, mm in zip(days, rain_row, strict=False) if mm is not None]
        has_smap = bool(smap and smap[k] is not None)
        sat = smap[k] / POROSITY if has_smap else national_saturation
        sat = min(1.0, sat) if sat is not None else None

        flood = FloodInputs(
            rain=daily,
            saturation=sat,
            saturation_source="smap" if has_smap else "nasa_power",
            saturation_date=None,
            normal_mm_per_day=normals.get(today.month),
            elevation_m=elevations[k] if k < len(elevations) else None,
        )
        water = WaterInputs(
            rain=daily,
            surface={today: Reading(sat, "smap" if has_smap else "nasa_power")} if sat is not None else {},
            root={},
            tmax={d: Reading(t, "open_meteo") for d, t in zip(days, tmax_row, strict=False) if t is not None},
            normals=normals,
        )
        flood_value = flood_score(flood, today)[0]
        water_value = water_score(water, today)[0]
        row = lambda key: weather[key][k] if k < len(weather[key]) else []  # noqa: E731
        crop = CropInputs(
            crop="rice",
            rain=daily,
            tmax=water.tmax,
            tmean={d: t for d, t in zip(days, row("tmean"), strict=False) if t is not None},
            humidity={d: h for d, h in zip(days, row("humidity"), strict=False) if h is not None},
            water_score=water_value,
            flood_score=flood_value,
        )
        scores[(lat, lon)] = {"flood_risk": flood_value, "water_stress": water_value, "crop_health": crop_score(crop, today)[0]}
    return scores
