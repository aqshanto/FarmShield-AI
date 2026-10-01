"""Slow-changing facts about a place: terrain height and the rainfall normal.

- Elevation: NASA SRTM (Shuttle Radar Topography Mission, 90 m) via OpenTopoData.
  Low land floods first; in Bangladesh a few metres matter.
- Rainfall normal: NASA POWER climatology, mean daily rain for each month. Lets us say
  "this week was 3× wetter than normal for September".
Both are stored with fixed dates (SRTM flew in February 2000; one row per month for the
normal) and served regardless of the date window.
"""

from datetime import date

import httpx2

from app.pipeline.http import get
from app.pipeline.models import Location, Observation
from app.pipeline.sources.base import SourceError, SourceInfo

SRTM_URL = "https://api.opentopodata.org/v1/srtm90m"
SRTM_DATE = date(2000, 2, 11)  # SRTM mission launch
# Neighbours ~2 km away in 8 directions: how far the field sits above the lowest land nearby,
# which says more about flooding than height above sea level away from river deltas.
RELIEF_STEP_DEG = 0.02
NEIGHBOURS = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0)]

POWER_CLIMATOLOGY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
NORMAL_YEAR = 2001  # rows are dated <NORMAL_YEAR>-<month>-01


class SrtmElevationSource:
    info = SourceInfo(
        id="srtm",
        mission="SRTM",
        provider="NASA SRTM via OpenTopoData",
        product="SRTM 90 m digital elevation model",
        variables=("elevation", "height_above_low"),
        requires_token=False,
        ttl_hours=24 * 365,
        overlap_days=0,
        note="Terrain height: low-lying fields flood first.",
    )

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        points = [(location.lat, location.lon)] + [
            (round(location.lat + dy * RELIEF_STEP_DEG, 5), round(location.lon + dx * RELIEF_STEP_DEG, 5)) for dy, dx in NEIGHBOURS
        ]
        response = await get(client, SRTM_URL, params={"locations": "|".join(f"{lat},{lon}" for lat, lon in points)}, retry_rate_limited=True)
        try:
            heights = [r["elevation"] for r in response.json()["results"]]
            elevation = heights[0]
        except (KeyError, IndexError, TypeError) as error:
            raise SourceError(f"Unexpected OpenTopoData payload: {error}") from None
        if elevation is None:
            return []
        observations = [Observation(self.info.id, "elevation", SRTM_DATE, float(elevation), "m")]
        around = [h for h in heights[1:] if h is not None]
        if len(around) >= 4:
            observations.append(Observation(self.info.id, "height_above_low", SRTM_DATE, max(0.0, float(elevation) - min(around)), "m"))
        return observations


async def srtm_elevations(client: httpx2.AsyncClient, points: list[tuple[float, float]]) -> list[float | None]:
    """Elevation for many points (OpenTopoData allows 100 per request, 1 request/second)."""
    import asyncio

    out: list[float | None] = []
    for i in range(0, len(points), 100):
        if i:
            await asyncio.sleep(1.1)
        batch = points[i : i + 100]
        response = await get(client, SRTM_URL, params={"locations": "|".join(f"{lat},{lon}" for lat, lon in batch)}, retry_rate_limited=True)
        out.extend(r.get("elevation") for r in response.json().get("results", []))
    return out


class PowerClimatologySource:
    info = SourceInfo(
        id="power_climatology",
        mission="POWER",
        provider="NASA Langley POWER",
        product="Monthly rainfall climatology",
        variables=("precipitation_normal",),
        requires_token=False,
        ttl_hours=24 * 365,
        overlap_days=0,
        note="Normal daily rainfall for each month: the 'historical pattern' behind flood risk.",
    )

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        response = await get(
            client,
            POWER_CLIMATOLOGY_URL,
            params={"parameters": "PRECTOTCORR", "community": "AG", "latitude": location.lat, "longitude": location.lon, "format": "JSON"},
        )
        try:
            monthly = response.json()["properties"]["parameter"]["PRECTOTCORR"]
        except (KeyError, TypeError) as error:
            raise SourceError(f"Unexpected POWER climatology payload: {error}") from None
        return [
            Observation(self.info.id, "precipitation_normal", date(NORMAL_YEAR, i + 1, 1), float(monthly[m]), "mm/day")
            for i, m in enumerate(MONTHS)
            if monthly.get(m) is not None and monthly[m] > -999
        ]
