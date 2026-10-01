"""Weather forecast via Open-Meteo (no key), with MET Norway as a backup. The one non-NASA input.

NASA missions measure what already happened; early flood warnings also need what's coming.
Open-Meteo blends national weather models (NOAA GFS, DWD ICON, ECMWF). We also take its
last 3 days, which fill the gap until NASA's own rainfall products catch up.
https://open-meteo.com/en/docs

Open-Meteo's free tier limits requests per server address, and cloud hosts share
addresses. When it refuses (HTTP 429 or any failure), the forecast comes from MET Norway's
Locationforecast instead (free, global, ECMWF-based; it asks only for an identifying
User-Agent), and Open-Meteo is left alone for a while. MET has no past days; NASA's own
GPM and POWER rainfall cover those.
https://api.met.no/weatherapi/locationforecast/2.0/documentation
"""

import logging
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

import httpx2

from app.pipeline.http import get
from app.pipeline.models import Location, Observation, VariableId
from app.pipeline.sources.base import RateLimitedError, SourceError, SourceInfo

log = logging.getLogger("farmshield.forecast")

URL = "https://api.open-meteo.com/v1/forecast"
MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
MET_USER_AGENT = "FarmShield-AI/1.0 (NASA Space Apps Challenge; https://github.com/aqshanto/FarmShield-AI)"
# After Open-Meteo refuses, go straight to MET for this long (a quota won't refill sooner).
OPEN_METEO_PAUSE = timedelta(minutes=15)
_open_meteo_paused_until: datetime | None = None
PAST_DAYS = 3
FORECAST_DAYS = 7

DAILY: dict[str, tuple[VariableId, str]] = {
    "precipitation_sum": ("precipitation_forecast", "mm/day"),
    "temperature_2m_max": ("temperature_max_forecast", "°C"),
    "temperature_2m_min": ("temperature_min_forecast", "°C"),
    "weather_code": ("weather_code", "WMO"),
    "temperature_2m_mean": ("temperature_mean_forecast", "°C"),
    "relative_humidity_2m_mean": ("humidity_forecast", "%"),
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


# MET symbol → WMO weather code (what the dashboard's conditions are keyed on).
MET_SYMBOLS = [
    ("thunder", 95),
    ("heavyrain", 65),
    ("heavysleet", 67),
    ("snow", 71),
    ("sleet", 67),
    ("lightrain", 61),
    ("rain", 63),
    ("fog", 45),
    ("partlycloudy", 2),
    ("cloudy", 3),
    ("fair", 1),
    ("clearsky", 0),
]


def met_weather_code(symbol: str) -> int:
    name = symbol.split("_")[0]
    return next((code for key, code in MET_SYMBOLS if key in name), 3)


def parse_met(payload: dict, source_id: str, lon: float, days: int = FORECAST_DAYS) -> list[Observation]:
    """MET's hourly-then-6-hourly steps → daily rain, high/low/mean temperature, humidity, weather.

    Days are the place's own calendar days (solar time from longitude), matching Open-Meteo's
    `timezone=auto` closely enough for daily totals.
    """
    try:
        steps = payload["properties"]["timeseries"]
        times = [datetime.fromisoformat(s["time"].replace("Z", "+00:00")) for s in steps]
    except (KeyError, TypeError, ValueError) as error:
        raise SourceError(f"Unexpected MET Norway payload: {error}") from None
    offset = timedelta(hours=round(lon / 15))
    rain: dict[date, float] = defaultdict(float)
    temps: dict[date, list[float]] = defaultdict(list)
    humidity: dict[date, list[float]] = defaultdict(list)
    codes: dict[date, int] = {}
    for i, (step, when) in enumerate(zip(steps, times, strict=True)):
        day = (when + offset).date()
        data = step.get("data", {})
        details = data.get("instant", {}).get("details", {})
        if "air_temperature" in details:
            temps[day].append(details["air_temperature"])
        if "relative_humidity" in details:
            humidity[day].append(details["relative_humidity"])
        # Each step's rain covers the time until the next step (1 h early on, 6 h later).
        gap = (times[i + 1] - when) if i + 1 < len(times) else timedelta(hours=6)
        period = data.get("next_1_hours") if gap <= timedelta(hours=1) else data.get("next_6_hours")
        if period:
            rain[day] += period.get("details", {}).get("precipitation_amount", 0.0)
            symbol = period.get("summary", {}).get("symbol_code")
            if symbol:
                codes[day] = max(codes.get(day, 0), met_weather_code(symbol))
    observations: list[Observation] = []
    for day in sorted(temps)[:days]:
        if day not in codes:  # only an instant reading, no forecast period: not a day we can describe
            continue
        values = {
            "precipitation_forecast": round(rain[day], 1),
            "temperature_max_forecast": max(temps[day]),
            "temperature_min_forecast": min(temps[day]),
            "temperature_mean_forecast": round(sum(temps[day]) / len(temps[day]), 1),
            # A rain symbol on a day with under 1 mm in total reads as cloudy, not rainy.
            "weather_code": codes.get(day, 0) if rain[day] >= 1 or not 51 <= codes.get(day, 0) <= 67 else 3,
        }
        if humidity[day]:
            values["humidity_forecast"] = round(sum(humidity[day]) / len(humidity[day]), 1)
        units = {v: u for v, u in DAILY.values()}
        observations += [Observation(source_id, variable, day, float(value), units[variable]) for variable, value in values.items()]
    return observations


class ForecastSource:
    info = SourceInfo(
        id="open_meteo",
        mission="FORECAST",
        provider="Open-Meteo (NOAA GFS · DWD ICON · ECMWF), MET Norway as backup",
        product="7-day daily forecast + last 3 days",
        variables=tuple(v for v, _ in DAILY.values()),
        requires_token=False,
        ttl_hours=3,
        overlap_days=PAST_DAYS,
        note="Weather forecast: the only non-NASA input, needed for early warnings.",
    )

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]:
        global _open_meteo_paused_until
        now = datetime.now(UTC)
        if _open_meteo_paused_until is None or now >= _open_meteo_paused_until:
            try:
                return await self._open_meteo(client, location)
            except SourceError as error:
                if isinstance(error, RateLimitedError):
                    _open_meteo_paused_until = now + OPEN_METEO_PAUSE
                log.warning("Open-Meteo unavailable (%s); using MET Norway", error)
        response = await get(client, MET_URL, params={"lat": round(location.lat, 4), "lon": round(location.lon, 4)}, headers={"User-Agent": MET_USER_AGENT})
        return parse_met(response.json(), self.info.id, location.lon)

    async def _open_meteo(self, client: httpx2.AsyncClient, location: Location) -> list[Observation]:
        response = await get(
            client,
            URL,
            params={
                "latitude": location.lat,
                "longitude": location.lon,
                "daily": ",".join(DAILY),
                "past_days": PAST_DAYS,
                "forecast_days": FORECAST_DAYS,
                "timezone": "auto",  # the place's own calendar day (Asia/Dhaka in Bangladesh)
            },
        )
        return parse_forecast(response.json(), self.info.id)
