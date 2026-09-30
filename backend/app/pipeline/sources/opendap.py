"""Mission-native GPM IMERG rainfall and SMAP soil moisture via NASA Earthdata Cloud OPeNDAP.

Granules are found through CMR (no login); each daily file is then subset to the single
grid cell over the farm, so we download a few bytes instead of whole global files.
Requires EARTHDATA_TOKEN (free: https://urs.earthdata.nasa.gov → Generate Token).
"""

import asyncio
import re
from datetime import date, datetime

import httpx2

from app.pipeline.grids import ease2_m09_index, imerg_index
from app.pipeline.http import get
from app.pipeline.models import Location, Observation, VariableId
from app.pipeline.sources.base import SourceInfo, TokenRequiredError

CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"
NUMBER = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")


def parse_opendap_values(text: str, variables: list[str]) -> list[float | None]:
    """Values for each requested variable from a Hyrax DAP4 CSV / DAP2 ASCII response.

    Lines look like `/Group/var[0][12][34], 0.271` or `var, 0.271`. Index brackets are
    ignored; the value is the last number on the variable's line.
    """
    found: list[float | None] = []
    lines = text.splitlines()
    for name in variables:
        base = name.rsplit("/", 1)[-1]
        value = None
        for line in lines:
            head, _, tail = line.partition(",")
            if tail and re.search(rf"(^|/){re.escape(base)}(\[|\s*$)", head.strip()):
                numbers = NUMBER.findall(tail)
                if numbers:
                    value = float(numbers[-1])
                    break
        found.append(value)
    return found


async def granule_links(client: httpx2.AsyncClient, collection: str, location: Location, start: date, end: date) -> dict[date, str]:
    """OPeNDAP URL for each daily granule of a collection in the date range."""
    response = await get(
        client,
        CMR_GRANULES,
        params={
            "collection_concept_id": collection,
            "temporal": f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z",
            "point": f"{location.lon},{location.lat}",
            "page_size": 200,
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

    def constraint(self, location: Location) -> tuple[str, list[str]]:
        raise NotImplementedError

    def valid(self, value: float) -> bool:
        raise NotImplementedError

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        if not self.token:
            raise TokenRequiredError("Set EARTHDATA_TOKEN in backend/.env to use this mission's own data")

        links = await granule_links(client, self.collection, location, start, end)
        ce, names = self.constraint(location)
        headers = {"Authorization": f"Bearer {self.token}"}
        semaphore = asyncio.Semaphore(6)

        async def one(day: date, url: str) -> Observation | None:
            async with semaphore:
                response = await get(client, f"{url}.dap.csv", params={"dap4.ce": ce}, headers=headers)
            for value in parse_opendap_values(response.text, names):
                if value is not None and self.valid(value):
                    return Observation(self.info.id, self.variable, day, round(value, 4), self.unit)
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
    )
    collection = "C2723754859-GES_DISC"
    variable = "precipitation"
    unit = "mm/day"

    def constraint(self, location: Location) -> tuple[str, list[str]]:
        ilon, ilat = imerg_index(location.lat, location.lon)
        return f"/precipitation[0][{ilon}][{ilat}]", ["precipitation"]

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
    )
    collection = "C2938664763-NSIDC_CPRD"
    variable = "soil_moisture"
    unit = "m³/m³"

    def constraint(self, location: Location) -> tuple[str, list[str]]:
        row, col = ease2_m09_index(location.lat, location.lon)
        am = f"/Soil_Moisture_Retrieval_Data_AM/soil_moisture[{row}][{col}]"
        pm = f"/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm[{row}][{col}]"
        # Morning overpass first (better quality); evening fills gaps.
        return f"{am};{pm}", ["soil_moisture", "soil_moisture_pm"]

    def valid(self, value: float) -> bool:
        return 0.0 <= value <= 0.7  # fill is -9999

