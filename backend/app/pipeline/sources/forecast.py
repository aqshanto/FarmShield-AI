"""Weather forecast via Open-Meteo (no key). The one non-NASA input.

NASA missions measure what already happened; early flood warnings also need what's coming.
Open-Meteo blends national weather models (NOAA GFS, DWD ICON, ECMWF). We also take its
last 3 days, which fill the gap until NASA's own rainfall products catch up.
https://open-meteo.com/en/docs
"""

from datetime import date, datetime

import httpx2

from app.pipeline.http import get
from app.pipeline.models import Location, Observation, VariableId
from app.pipeline.sources.base import SourceError, SourceInfo

URL = "https://api.open-meteo.com/v1/forecast"
PAST_DAYS = 3
FORECAST_DAYS = 7

DAILY: dict[str, tuple[VariableId, str]] = {
    "precipitation_sum": ("precipitation_forecast", "mm/day"),
    "temperature_2m_max": ("temperature_max_forecast", "°C"),
    "temperature_2m_min": ("temperature_min_forecast", "°C"),
    "weather_code": ("weather_code", "WMO"),
}


def parse_forecast(payload: dict, source_id: str) -> list[Observation]:
    try:
        daily = payload["daily"]
        days = [datetime.strptime(d, "%Y-%m-%d").date() for d in daily["time"]]
    except (KeyError, TypeError, ValueError) as error:
        raise SourceError(f"Unexpected Open-Meteo payload: {error}") from None
    observations = []
    for field, (variable, unit) in DAILY.items():
        for day, value in zip(days, daily.get(field, []), strict=False):
            if value is not None:
                observations.append(Observation(source_id, variable, day, float(value), unit))
    return observations


class ForecastSource:
    info = SourceInfo(
        id="open_meteo",
        mission="FORECAST",
        provider="Open-Meteo (NOAA GFS · DWD ICON · ECMWF)",
        product="7-day daily forecast + last 3 days",
        variables=tuple(v for v, _ in DAILY.values()),
        requires_token=False,
        ttl_hours=3,
        overlap_days=PAST_DAYS,
        note="Weather forecast: the only non-NASA input, needed for early warnings.",
    )

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        response = await get(
            client,
            URL,
            params={
                "latitude": location.lat,
                "longitude": location.lon,
                "daily": ",".join(DAILY),
                "past_days": PAST_DAYS,
                "forecast_days": FORECAST_DAYS,
                "timezone": "Asia/Dhaka",
            },
        )
        return parse_forecast(response.json(), self.info.id)
