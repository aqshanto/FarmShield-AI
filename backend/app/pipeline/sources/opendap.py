"""Mission-native GPM IMERG rainfall, SMAP soil moisture and GRACE groundwater via NASA Earthdata Cloud OPeNDAP.

Granules are found through CMR (no login); each daily file is then subset to the single
grid cell over the farm, so we download a few bytes instead of whole global files.
Requires EARTHDATA_TOKEN (free: https://urs.earthdata.nasa.gov → Generate Token).
"""

import asyncio
import re
from datetime import date, datetime

import httpx2

from app.pipeline.grids import GRACE_NLON, IMERG_NLAT, M09_COLS, ease2_m09_index, grace_index, imerg_index
from app.pipeline.http import get
from app.pipeline.models import Location, Observation, VariableId
from app.pipeline.sources.base import SourceInfo, TokenRequiredError

CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"
NUMBER = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")


def parse_opendap_values(text: str, variables: list[str]) -> list[list[float]]:
    """All values for each requested variable from a Hyrax DAP4 CSV / DAP2 ASCII response.

    Lines look like `/Group/var[0], 0.271, 0.283` (one line per leading index) or
    `var, 0.271`. Index brackets are ignored; numbers after the first comma are values.
    """
    found: list[list[float]] = []
    lines = text.splitlines()
    for name in variables:
        base = name.rsplit("/", 1)[-1]
        values: list[float] = []
        for line in lines:
            head, _, tail = line.partition(",")
            if tail and re.search(rf"(^|/){re.escape(base)}(\[|\s*$)", head.strip()):
                values.extend(float(n) for n in NUMBER.findall(tail))
        found.append(values)
    return found


def pair_slice(index: int, size: int) -> tuple[str, int]:
    """Hyrax returns an empty value for a single-element selection (verified live), so ask
    for two neighbouring cells and remember which one is ours."""
    if index + 1 < size:
        return f"[{index}:{index + 1}]", 0
    return f"[{index - 1}:{index}]", 1


async def granule_links(
    client: httpx2.AsyncClient, collection: str, location: Location, start: date, end: date, page_size: int = 200
) -> dict[date, str]:
    """OPeNDAP URL for each granule of a collection in the date range."""
    response = await get(
        client,
        CMR_GRANULES,
        params={
            "collection_concept_id": collection,
            "temporal": f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z",
            "point": f"{location.lon},{location.lat}",
            "page_size": page_size,
            "sort_key": "start_date",
        },
    )
    links: dict[date, str] = {}
    for entry in response.json().get("feed", {}).get("entry", []):
        href = next((link["href"] for link in entry.get("links", []) if "opendap.earthdata.nasa.gov" in link.get("href", "")), None)
        if href:
            links[datetime.fromisoformat(entry["time_start"].replace("Z", "+00:00")).date()] = href
    return links


class _OpendapPointSource:
    info: SourceInfo
    collection: str
    variable: VariableId
    unit: str

    def __init__(self, token: str | None):
        self.token = token

    def constraint(self, location: Location) -> tuple[str, list[str], int]:
        """DAP4 constraint, variable names in preference order, and our cell's position in each result."""
        raise NotImplementedError

    def valid(self, value: float) -> bool:
        raise NotImplementedError

    page_size = 200  # granules listed per window

    def pick(self, links: dict[date, str]) -> dict[date, str]:
        """The granules to read: all of them, unless a source needs only some."""
        return links

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        if not self.token:
            raise TokenRequiredError("Set EARTHDATA_TOKEN in backend/.env to use this mission's own data")

        links = self.pick(await granule_links(client, self.collection, location, start, end, self.page_size))
        ce, names, position = self.constraint(location)
        headers = {"Authorization": f"Bearer {self.token}"}
        semaphore = asyncio.Semaphore(6)

        async def one(day: date, url: str) -> Observation | None:
            async with semaphore:
                response = await get(client, f"{url}.dap.csv", params={"dap4.ce": ce}, headers=headers)
            for values in parse_opendap_values(response.text, names):
                if len(values) > position and self.valid(values[position]):
                    return Observation(self.info.id, self.variable, day, round(values[position], 4), self.unit)
            return None

        results = await asyncio.gather(*(one(day, url) for day, url in sorted(links.items())))
        return [o for o in results if o is not None]


class ImergSource(_OpendapPointSource):
    info = SourceInfo(
        id="gpm_imerg",
        mission="GPM",
        provider="NASA GES DISC · Earthdata Cloud OPeNDAP",
        product="GPM_3IMERGDL v07 · daily 0.1° rainfall (Late run)",
        variables=("precipitation",),
        requires_token=True,
        ttl_hours=6,
        overlap_days=3,
        chunk_days=15,  # one request per day
        slow=True,
    )
    collection = "C2723754859-GES_DISC"
    variable = "precipitation"
    unit = "mm/day"

    def constraint(self, location: Location) -> tuple[str, list[str], int]:
        ilon, ilat = imerg_index(location.lat, location.lon)
        lat_slice, position = pair_slice(ilat, IMERG_NLAT)
        return f"/precipitation[0][{ilon}]{lat_slice}", ["precipitation"], position

    def valid(self, value: float) -> bool:
        return 0 <= value < 2000  # fill is -9999.9


class SmapSource(_OpendapPointSource):
    info = SourceInfo(
        id="smap",
        mission="SMAP",
        provider="NSIDC · Earthdata Cloud OPeNDAP",
        product="SPL3SMP_E v006 · daily 9 km soil moisture",
        variables=("soil_moisture",),
        requires_token=True,
        ttl_hours=12,
        overlap_days=3,
        chunk_days=15,  # one request per day
        slow=True,
    )
    collection = "C2938664763-NSIDC_CPRD"
    variable = "soil_moisture"
    unit = "m³/m³"

    def constraint(self, location: Location) -> tuple[str, list[str], int]:
        row, col = ease2_m09_index(location.lat, location.lon)
        col_slice, position = pair_slice(col, M09_COLS)
        am = f"/Soil_Moisture_Retrieval_Data_AM/soil_moisture[{row}]{col_slice}"
        pm = f"/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm[{row}]{col_slice}"
        # Morning overpass first (better quality); evening fills gaps.
        return f"{am};{pm}", ["soil_moisture", "soil_moisture_pm"], position

    def valid(self, value: float) -> bool:
        return 0.0 <= value <= 0.7  # fill is -9999


# Boro is pumped hardest in March and April, and the rains refill the ground from May: late
# April is when groundwater is lowest and matters most.
DRY_SEASON_END = (4, 25)


class GraceGroundwaterSource(_OpendapPointSource):
    """Groundwater from GRACE and GRACE-FO, assimilated into a land model at 0.25°.

    The value is a percentile against 1948–2012 (0 = driest on record). A long view is what
    matters, so a first fetch reads one week per year near the end of the dry season since
    2003 (about 25 requests), plus the newest week; later refreshes read only new weeks.
    """

    info = SourceInfo(
        id="grace",
        mission="GRACE",
        provider="NASA GES DISC · Earthdata Cloud OPeNDAP",
        product="GRACEDADM_CLSM025GL_7D v3.0 · weekly 0.25° groundwater percentile (GRACE/GRACE-FO data assimilation)",
        variables=("groundwater_percentile",),
        requires_token=True,
        ttl_hours=24 * 7,  # a weekly product, published about two months late
        overlap_days=14,
        note="One reading per year at the end of the dry season since 2003, plus the newest week.",
        min_window_days=9000,  # back to the start of the record (2003)
        slow=True,
        timeout_s=420,
    )
    collection = "C2283200566-GES_DISC"
    variable = "groundwater_percentile"
    unit = "%"
    page_size = 2000  # ~52 weekly granules a year since 2003

    def constraint(self, location: Location) -> tuple[str, list[str], int]:
        ilat, ilon = grace_index(location.lat, location.lon)
        lon_slice, position = pair_slice(ilon, GRACE_NLON)
        return f"/gws_inst[0][{ilat}]{lon_slice}", ["gws_inst"], position

    def valid(self, value: float) -> bool:
        return 0.0 <= value <= 100.0  # fill is -9999

    def pick(self, links: dict[date, str]) -> dict[date, str]:
        """One week per year near the end of the dry season, and the newest week."""
        if not links:
            return {}
        chosen = {max(links): links[max(links)]}
        for year in {d.year for d in links}:
            target = date(year, *DRY_SEASON_END)
            nearest = min((d for d in links if d.year == year), key=lambda d: abs((d - target).days))
            if abs((nearest - target).days) <= 7:
                chosen[nearest] = links[nearest]
        return chosen
