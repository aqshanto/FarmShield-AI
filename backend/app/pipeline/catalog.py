"""Mission freshness from NASA's Common Metadata Repository (no login).

For each mission we ask CMR for the newest granule, which tells farmers and judges how
recent the satellite data really is.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime

import httpx2

from app.pipeline.http import get

CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"


@dataclass(frozen=True)
class Collection:
    mission: str
    concept_id: str
    product: str


COLLECTIONS = [
    Collection("SMAP", "C2938664763-NSIDC_CPRD", "SPL3SMP_E v006 soil moisture"),
    Collection("GPM", "C2723754859-GES_DISC", "GPM_3IMERGDL v07 daily rainfall"),
    Collection("MODIS", "C1748066515-LPCLOUD", "MOD13Q1 v061 vegetation index"),
    Collection("VIIRS", "C2519122065-LPCLOUD", "VJ113A1 v002 vegetation index (NOAA-20)"),
]


@dataclass(frozen=True)
class Freshness:
    mission: str
    product: str
    latest_granule: datetime | None
    granule_id: str | None
    error: str | None = None


async def latest_granule(client: httpx2.AsyncClient, collection: Collection) -> Freshness:
    try:
        response = await get(
            client,
            CMR_GRANULES,
            params={"collection_concept_id": collection.concept_id, "sort_key": "-start_date", "page_size": 1},
        )
        entries = response.json().get("feed", {}).get("entry", [])
        if not entries:
            return Freshness(collection.mission, collection.product, None, None, "No granules found")
        entry = entries[0]
        started = datetime.fromisoformat(entry["time_start"].replace("Z", "+00:00"))
        return Freshness(collection.mission, collection.product, started, entry.get("title"))
    except Exception as error:  # reported per mission, never fatal
        return Freshness(collection.mission, collection.product, None, None, str(error))


async def mission_freshness(client: httpx2.AsyncClient) -> list[Freshness]:
    return list(await asyncio.gather(*(latest_granule(client, c) for c in COLLECTIONS)))
