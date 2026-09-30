"""MODIS and VIIRS vegetation index via the ORNL DAAC Land Product Subsets API (no login).

MODIS MOD13Q1 gives the current 16-day NDVI at 250 m. The ORNL copy of VIIRS VNP13A1 ends
in 2024, so VIIRS is used for what it's great at here: a 2013–2023 *seasonal normal*, so
today's greenness can be compared with what's normal for this time of year.
https://modis.ornl.gov/data/modis_webservice.html
"""

import asyncio
from datetime import date, datetime, timedelta
from statistics import median

import httpx2

from app.pipeline.http import get
from app.pipeline.models import Location, Observation, Quality
from app.pipeline.sources.base import SourceError, SourceInfo

BASE = "https://modis.ornl.gov/rst/api/v1"
NDVI_SCALE = 0.0001
# Pixel reliability differs per product; anything not listed (cloud, cloud shadow,
# snow/ice, fill) is rejected.
RELIABILITY: dict[str, dict[int, Quality]] = {
    # MOD13Q1 / MYD13Q1: 0 good · 1 marginal · 2 snow/ice · 3 cloudy · -1 fill
    "MOD13Q1": {0: "good", 1: "marginal"},
    "MYD13Q1": {0: "good", 1: "marginal"},
    # VNP13A1: 0 excellent · 1 good · 2 acceptable · 3 marginal · 4 pass · 5 questionable
    #          6 poor · 7 cloud shadow · 8 snow/ice · 9 cloud · 10+ estimated/fill
    "VNP13A1": {0: "good", 1: "good", 2: "good", 3: "marginal", 4: "marginal", 5: "marginal", 6: "marginal"},
}
MAX_DATES_PER_REQUEST = 10  # ORNL API limit
COMPOSITE_DAYS = 16
# Days between composite dates. VIIRS 16-day composites are issued every 8 days.
CADENCE_DAYS = {"MOD13Q1": 16, "MYD13Q1": 16, "VNP13A1": 8}


def modis_date(d: date) -> str:
    return f"A{d.year}{d.timetuple().tm_yday:03d}"


async def fetch_band(client: httpx2.AsyncClient, product: str, band: str, location: Location, start: date, end: date) -> dict[date, int]:
    """Values of one band at a point, keyed by composite date. Splits long ranges to respect API limits."""
    values: dict[date, int] = {}
    # Stay under the 10-dates-per-request limit for this product's cadence.
    chunk = timedelta(days=CADENCE_DAYS.get(product, 8) * MAX_DATES_PER_REQUEST - 1)
    cursor = start
    while cursor <= end:
        chunk_end = min(end, cursor + chunk)
        response = await get(
            client,
            f"{BASE}/{product}/subset",
            params={
                "latitude": location.lat,
                "longitude": location.lon,
                "band": band,
                "startDate": modis_date(cursor),
                "endDate": modis_date(chunk_end),
                "kmAboveBelow": 0,
                "kmLeftRight": 0,
            },
        )
        try:
            for row in response.json().get("subset", []):
                values[datetime.strptime(row["calendar_date"], "%Y-%m-%d").date()] = int(row["data"][0])
        except (KeyError, ValueError, TypeError, IndexError) as error:
            raise SourceError(f"Unexpected ORNL payload for {product}/{band}: {error}") from None
        cursor = chunk_end + timedelta(days=1)
    return values


def classify(product: str, ndvi_raw: int, reliability: int | None) -> tuple[float, Quality] | None:
    """Scale raw NDVI and grade it with the product's reliability flag. None for no-data pixels."""
    if ndvi_raw <= -3000:  # fill value
        return None
    value = round(ndvi_raw * NDVI_SCALE, 4)
    if reliability is None:
        return value, "marginal"
    return value, RELIABILITY[product].get(reliability, "rejected")


class ModisNdviSource:
    info = SourceInfo(
        id="modis",
        mission="MODIS",
        provider="ORNL DAAC",
        product="MOD13Q1 + MYD13Q1 v061 · 250 m 16-day NDVI (Terra + Aqua)",
        variables=("ndvi",),
        requires_token=False,
        ttl_hours=12,
        overlap_days=32,
        note="Terra and Aqua composites interleave every 8 days. Cloudy pixels are flagged and never shown as plant health. ORNL publishes composites ~6 weeks after capture.",
        min_window_days=120,
    )
    products = ("MOD13Q1", "MYD13Q1")

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        # Composites are dated by their first day, so look back one period to catch the latest.
        start = start - timedelta(days=COMPOSITE_DAYS)
        bands = await asyncio.gather(
            *(
                fetch_band(client, product, band, location, start, end)
                for product in self.products
                for band in ("250m_16_days_NDVI", "250m_16_days_pixel_reliability")
            )
        )
        observations = []
        for i, product in enumerate(self.products):
            ndvi, reliability = bands[2 * i], bands[2 * i + 1]
            for day, raw in sorted(ndvi.items()):
                graded = classify(product, raw, reliability.get(day))
                if graded:
                    observations.append(Observation(self.info.id, "ndvi", day, graded[0], "0–1", graded[1]))
        return sorted(observations, key=lambda o: o.date)


NORMAL_YEARS = range(2013, 2024)


def _same_day(year: int, d: date) -> date:
    try:
        return d.replace(year=year)
    except ValueError:  # 29 February
        return d.replace(year=year, day=28)


def _day_distance(a: date, b: date) -> int:
    diff = abs(a.timetuple().tm_yday - b.timetuple().tm_yday)
    return min(diff, 365 - diff)


class ViirsNormalSource:
    info = SourceInfo(
        id="viirs",
        mission="VIIRS",
        provider="ORNL DAAC",
        product="VNP13A1 · 500 m 16-day NDVI, 2013–2023 seasonal normal",
        variables=("ndvi_normal",),
        requires_token=False,
        ttl_hours=24 * 30,  # a climatology barely changes
        overlap_days=0,
        note="Historical VIIRS archive used as the 'normal for this time of year' baseline.",
        min_window_days=120,
    )

    step_days = 8
    window_days = 12

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        semaphore = asyncio.Semaphore(4)
        pad = timedelta(days=COMPOSITE_DAYS)

        async def year_values(year: int) -> list[tuple[date, float]]:
            y_start, y_end = _same_day(year, start) - pad, _same_day(year, end) + pad
            if y_end < y_start:  # window wraps across new year
                y_end = _same_day(year + 1, end) + pad
            async with semaphore:
                ndvi = await fetch_band(client, "VNP13A1", "500_m_16_days_NDVI", location, y_start, y_end)
                reliability = await fetch_band(client, "VNP13A1", "500_m_16_days_pixel_reliability", location, y_start, y_end)
            accepted = []
            for day, raw in ndvi.items():
                graded = classify("VNP13A1", raw, reliability.get(day))
                if graded and graded[1] != "rejected":
                    accepted.append((day, graded[0]))
            return accepted

        per_year = await asyncio.gather(*(year_values(y) for y in NORMAL_YEARS))
        history = [item for year in per_year for item in year]

        observations = []
        day = end
        while day >= start:
            nearby = [value for d, value in history if _day_distance(d, day) <= self.window_days]
            if len(nearby) >= 3:  # need a few years before calling something "normal"
                # Median: robust to the odd residual-cloud pixel that slipped through QA.
                observations.append(Observation(self.info.id, "ndvi_normal", day, round(median(nearby), 4), "0–1"))
            day -= timedelta(days=self.step_days)
        return sorted(observations, key=lambda o: o.date)
