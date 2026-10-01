"""NASA POWER daily point data (no login).

Rainfall and soil wetness here come from NASA's MERRA-2 reanalysis, which assimilates
satellite observations. We use it as the always-available stand-in for GPM rainfall and
SMAP soil moisture when no Earthdata token is configured. Latency is about 3 days.
https://power.larc.nasa.gov/docs/services/api/temporal/daily/
"""

from datetime import date, datetime

import httpx2

from app.pipeline.http import get
from app.pipeline.models import Location, Observation, VariableId
from app.pipeline.sources.base import SourceError, SourceInfo

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"

PARAMETERS: dict[str, tuple[VariableId, str]] = {
    "PRECTOTCORR": ("precipitation", "mm/day"),
    "GWETTOP": ("soil_wetness", "0–1"),
    "GWETROOT": ("root_zone_wetness", "0–1"),
    "T2M_MAX": ("temperature_max", "°C"),
    "T2M": ("temperature_mean", "°C"),
    "RH2M": ("humidity", "%"),
}


class PowerSource:
    info = SourceInfo(
        id="nasa_power",
        mission="POWER",
        provider="NASA Langley POWER",
        product="Daily agroclimatology (MERRA-2 based)",
        variables=tuple(v for v, _ in PARAMETERS.values()),
        requires_token=False,
        ttl_hours=6,
        overlap_days=5,
        note="Stand-in for GPM rainfall and SMAP soil moisture when no Earthdata token is set.",
    )

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        response = await get(
            client,
            URL,
            params={
                "parameters": ",".join(PARAMETERS),
                "community": "AG",
                "latitude": location.lat,
                "longitude": location.lon,
                "start": start.strftime("%Y%m%d"),
                "end": end.strftime("%Y%m%d"),
                "format": "JSON",
            },
        )
        return parse_power(response.json(), self.info.id)


def parse_power(payload: dict, source_id: str) -> list[Observation]:
    try:
        parameters: dict[str, dict[str, float]] = payload["properties"]["parameter"]
    except (KeyError, TypeError) as error:
        raise SourceError(f"Unexpected POWER payload: {error}") from None
    fill = payload.get("header", {}).get("fill_value", -999.0)

    observations = []
    for name, series in parameters.items():
        if name not in PARAMETERS:
            continue
        variable, unit = PARAMETERS[name]
        for day, value in series.items():
            if value is None or value == fill or value <= -999:
                continue  # not yet available (POWER lags ~3 days) or missing
            observations.append(
                Observation(source_id, variable, datetime.strptime(day, "%Y%m%d").date(), float(value), unit)
            )
    return observations
