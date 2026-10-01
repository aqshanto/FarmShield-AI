"""Live risk for every map cell over Bangladesh, using the same engines as the farms.

Per cell (0.2°, land only):
  terrain     NASA SRTM elevation (OpenTopoData, batched; cached for a year)
  weather     Open-Meteo daily rain, high/mean temperature and humidity, last 30 days + next 5, one
              multi-point request on a 0.4° lattice (cached 6 h). When Open-Meteo refuses (its free
              quota is per server address), the past 30 days come from NASA POWER's regional
              daily grid and the next days from MET Norway on a 1° lattice.
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
from app.pipeline.sources.base import RateLimitedError, SourceError
from app.pipeline.sources.forecast import MET_URL, MET_USER_AGENT, parse_met
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
POWER_REGIONAL_URL = "https://power.larc.nasa.gov/api/temporal/daily/regional"
# POWER regional serves one parameter per request: grid variable → POWER parameter.
POWER_GRID_PARAMETERS = {"rain": "PRECTOTCORR", "tmax": "T2M_MAX", "tmean": "T2M", "humidity": "RH2M"}
MET_STEP_DEG = 1.0
PAST_DAYS, FORECAST_DAYS = 30, 5
RAIN_TTL = timedelta(hours=6)
# Weather is sampled on a 0.4° lattice (each point serves the 0.2° cells around it): weather
# models are ~10–25 km anyway, and it cuts Open-Meteo usage about 4×, which matters on
# shared cloud addresses with a per-address daily quota.
WEATHER_STEP_DEG = 0.4
WEATHER_PAUSE = timedelta(minutes=30)
_weather_paused_until: datetime | None = None
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


def weather_points(cells: list[tuple[float, float]], step: float = WEATHER_STEP_DEG) -> tuple[list[tuple[float, float]], list[int]]:
    """The coarse weather points to ask for, and which one serves each cell."""
    snap = lambda v: round(round(v / step) * step, 2)  # noqa: E731
    points: list[tuple[float, float]] = []
    index: dict[tuple[float, float], int] = {}
    owner = []
    for lat, lon in cells:
        key = (snap(lat), snap(lon))
        if key not in index:
            index[key] = len(points)
            points.append(key)
        owner.append(index[key])
    return points, owner


async def _weather(pipeline: PipelineService, client: httpx2.AsyncClient, cells: list[tuple[float, float]], today: date) -> dict:
    """Open-Meteo first; NASA POWER + MET Norway when it refuses (or the last good reading)."""
    global _weather_paused_until
    key = "grid_weather_v3"
    cached = _cached(pipeline, key, RAIN_TTL)
    if cached is not None:
        return cached
    if not (_weather_paused_until and pipeline.now() < _weather_paused_until):
        try:
            value = await _weather_open_meteo(pipeline, client, cells)
        except SourceError as error:
            if isinstance(error, RateLimitedError):
                _weather_paused_until = pipeline.now() + WEATHER_PAUSE
            log.warning("Open-Meteo grid weather unavailable (%s); using NASA POWER + MET Norway", error)
        else:
            pipeline.store.cache_set(key, value, pipeline.now())
            return value
    try:
        value = await _weather_nasa(client, cells, today)
    except Exception as error:
        stale = pipeline.store.cache_get(key)
        if stale:  # older weather beats no weather
            log.warning("Backup grid weather failed too (%s); keeping the last reading", error)
            return stale[0]
        raise
    pipeline.store.cache_set(key, value, pipeline.now())
    return value


async def _weather_open_meteo(pipeline: PipelineService, client: httpx2.AsyncClient, cells: list[tuple[float, float]]) -> dict:
    points, owner = weather_points(cells)
    days: list[str] = []
    rain_cells: list[list[float | None]] = []
    tmax_cells: list[list[float | None]] = []
    tmean_cells: list[list[float | None]] = []
    humid_cells: list[list[float | None]] = []
    for i in range(0, len(points), 400):  # comfortably within Open-Meteo's multi-location limit
        batch = points[i : i + 400]
        response = await get(
            client,
            FORECAST_URL,
            params={
                "latitude": ",".join(str(lat) for lat, _ in batch),
                "longitude": ",".join(str(lon) for _, lon in batch),
                "daily": "precipitation_sum,temperature_2m_max,temperature_2m_mean,relative_humidity_2m_mean",
                "past_days": PAST_DAYS,
                "forecast_days": FORECAST_DAYS,
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
    # Back to one row per cell, so everything downstream stays per cell.
    spread = lambda rows: [rows[o] if o < len(rows) else [] for o in owner]  # noqa: E731
    return {
        "days": days,
        "rain": spread(rain_cells),
        "tmax": spread(tmax_cells),
        "tmean": spread(tmean_cells),
        "humidity": spread(humid_cells),
        "past_source": "open_meteo",
    }


def _nearest(points: list[tuple[float, float]], lat: float, lon: float) -> int:
    return min(range(len(points)), key=lambda i: (points[i][0] - lat) ** 2 + (points[i][1] - lon) ** 2)


def parse_power_regional(payload: dict) -> dict[tuple[float, float], dict[date, float]]:
    """POWER regional GeoJSON → {(lat, lon): {day: value}}, without fill values."""
    fill = payload.get("header", {}).get("fill_value", -999.0)
    out: dict[tuple[float, float], dict[date, float]] = {}
    for feature in payload.get("features", []):
        lon, lat = feature["geometry"]["coordinates"][:2]
        (series,) = feature["properties"]["parameter"].values()
        out[(lat, lon)] = {datetime.strptime(d, "%Y%m%d").date(): v for d, v in series.items() if v is not None and v != fill}
    if not out:
        raise SourceError(f"NASA POWER regional returned no data: {payload.get('messages')}")
    return out


async def _weather_nasa(client: httpx2.AsyncClient, cells: list[tuple[float, float]], today: date) -> dict:
    """Past 30 days from NASA POWER's regional grid (~0.5°, four requests, a few days behind),
    the next days from MET Norway on a 1° lattice. Same shape as the Open-Meteo reading."""
    lats, lons = [c[0] for c in cells], [c[1] for c in cells]
    start, end = today - timedelta(days=PAST_DAYS), today
    bbox = {
        "latitude-min": round(min(lats) - 0.25, 2),
        "latitude-max": round(max(lats) + 0.25, 2),
        "longitude-min": round(min(lons) - 0.3, 2),
        "longitude-max": round(max(lons) + 0.3, 2),
    }

    async def power(parameter: str):
        response = await get(
            client,
            POWER_REGIONAL_URL,
            params={"parameters": parameter, "community": "AG", **bbox, "start": f"{start:%Y%m%d}", "end": f"{end:%Y%m%d}", "format": "JSON"},
        )
        return parse_power_regional(response.json())

    met_points, met_owner = weather_points(cells, MET_STEP_DEG)
    limit = asyncio.Semaphore(4)  # MET asks for modest concurrency

    async def met(lat: float, lon: float) -> dict[str, dict[date, float]]:
        async with limit:
            try:
                response = await get(client, MET_URL, params={"lat": lat, "lon": lon}, headers={"User-Agent": MET_USER_AGENT}, retries=1)
            except SourceError as error:
                log.warning("MET Norway forecast failed at %s,%s: %s", lat, lon, error)
                return {}
        by_variable: dict[str, dict[date, float]] = {}
        for o in parse_met(response.json(), "met_norway", lon, days=FORECAST_DAYS):
            by_variable.setdefault(o.variable, {})[o.date] = o.value
        return by_variable

    past_list = await asyncio.gather(*(power(p) for p in POWER_GRID_PARAMETERS.values()))
    past = dict(zip(POWER_GRID_PARAMETERS, past_list, strict=True))
    coming = await asyncio.gather(*(met(lat, lon) for lat, lon in met_points))
    met_variable = {"rain": "precipitation_forecast", "tmax": "temperature_max_forecast", "tmean": "temperature_mean_forecast", "humidity": "humidity_forecast"}

    days = [today + timedelta(days=i) for i in range(-PAST_DAYS, FORECAST_DAYS)]
    power_points = list(past["rain"])
    value: dict = {"days": [d.isoformat() for d in days], "past_source": "nasa_power"}
    for name in POWER_GRID_PARAMETERS:
        rows = []
        for k, (lat, lon) in enumerate(cells):
            observed = past[name].get(power_points[_nearest(power_points, lat, lon)], {})
            forecast = coming[met_owner[k]].get(met_variable[name], {})
            # Measured days from NASA; today and later from the forecast.
            rows.append([forecast.get(d, observed.get(d)) if d >= today else observed.get(d) for d in days])
        value[name] = rows
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
        elevations, weather = await asyncio.gather(_elevations(pipeline, client, cells), _weather(pipeline, client, cells, today))
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
        past_source = weather.get("past_source", "open_meteo")
        daily = [DailyRain(d, mm, past_source if d < today else "open_meteo", d > today) for d, mm in zip(days, rain_row, strict=False) if mm is not None]
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
