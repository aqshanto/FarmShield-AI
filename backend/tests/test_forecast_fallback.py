"""Open-Meteo refusing (HTTP 429) must never break forecasts, farms, spot checks or the map."""

import asyncio
from datetime import UTC, date, datetime, timedelta

import httpx2
import pytest

from app.pipeline.http import get
from app.pipeline.models import Location
from app.pipeline.sources import forecast as fc
from app.pipeline.sources.base import RateLimitedError
from app.pipeline.sources.forecast import ForecastSource, met_weather_code, parse_met
from app.risk import grid
from app.services.dashboard import build_custom_dashboard
from app.services.custom_farms import parse_farm_id
from tests.test_custom_farms import NOW, Canned, make_pipeline, obs, seeded_sources

BOGURA = Location("pt_24.85_89.37", 24.85, 89.37)


def client_for(handler) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(transport=httpx2.MockTransport(handler))


@pytest.fixture(autouse=True)
def no_waiting(monkeypatch):
    real_sleep = asyncio.sleep
    monkeypatch.setattr(asyncio, "sleep", lambda *_: real_sleep(0))
    monkeypatch.setattr(fc, "_open_meteo_paused_until", None)
    monkeypatch.setattr(grid, "_weather_paused_until", None)


def met_payload(start: datetime, hours: int = 48, six_hourly: int = 24) -> dict:
    """Hourly steps, then 6-hourly ones, like MET's compact forecast."""
    steps, t = [], start
    for i in range(hours + six_hourly):
        hourly = i < hours
        period = {"summary": {"symbol_code": "rain" if t.hour == 6 else "cloudy"}, "details": {"precipitation_amount": 1.0 if t.hour == 6 else 0.0}}
        steps.append(
            {
                "time": t.isoformat().replace("+00:00", "Z"),
                "data": {
                    "instant": {"details": {"air_temperature": 20 + t.hour / 2, "relative_humidity": 80.0}},
                    "next_1_hours" if hourly else "next_6_hours": period,
                },
            }
        )
        t += timedelta(hours=1 if hourly else 6)
    return {"properties": {"timeseries": steps}}


# --- http ------------------------------------------------------------------------------------


def test_429_fails_fast_unless_asked_to_wait():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx2.Response(429) if len(calls) == 1 else httpx2.Response(200, json={})

    async def go(**kwargs):
        async with client_for(handler) as client:
            return await get(client, "https://x.test", **kwargs)

    with pytest.raises(RateLimitedError):
        asyncio.run(go())
    assert len(calls) == 1
    calls.clear()
    assert asyncio.run(go(retry_rate_limited=True)).status_code == 200
    assert len(calls) == 2


# --- MET Norway --------------------------------------------------------------------------------


def test_met_symbols_map_to_weather_codes():
    assert [met_weather_code(s) for s in ("clearsky_day", "fair_night", "partlycloudy_day", "cloudy", "lightrain", "rain", "heavyrainshowers_day", "rainandthunder")] == [
        0, 1, 2, 3, 61, 63, 65, 95,
    ]


def test_met_steps_become_local_daily_totals():
    observations = parse_met(met_payload(datetime(2026, 10, 1, 0, tzinfo=UTC)), "open_meteo", lon=90.0)
    by_day: dict[date, dict[str, float]] = {}
    for o in observations:
        by_day.setdefault(o.date, {})[o.variable] = o.value
    days = sorted(by_day)
    assert days[0] == date(2026, 10, 1) and len(days) <= 7
    # 06 UTC rain falls on the Bangladesh calendar day (UTC+6); hourly days get 1 mm, 6-hourly too.
    assert by_day[date(2026, 10, 2)]["precipitation_forecast"] == 1.0
    assert by_day[date(2026, 10, 2)]["weather_code"] == 63  # 1 mm or more with a rain symbol: a rain day
    assert by_day[date(2026, 10, 2)]["temperature_max_forecast"] > by_day[date(2026, 10, 2)]["temperature_min_forecast"]
    assert by_day[date(2026, 10, 2)]["humidity_forecast"] == 80.0


def test_forecast_falls_back_to_met_norway_and_leaves_open_meteo_alone_for_a_while():
    hosts = []
    payload = met_payload(datetime.now(UTC).replace(minute=0, second=0, microsecond=0))

    def handler(request):
        hosts.append(request.url.host)
        if request.url.host == "api.open-meteo.com":
            return httpx2.Response(429)
        assert "FarmShield" in request.headers["user-agent"]
        return httpx2.Response(200, json=payload)

    async def fetch():
        async with client_for(handler) as client:
            return await ForecastSource().fetch(client, BOGURA, date.today(), date.today())

    first = asyncio.run(fetch())
    assert {o.variable for o in first} >= {"precipitation_forecast", "temperature_max_forecast", "weather_code"}
    assert hosts == ["api.open-meteo.com", "api.met.no"]
    asyncio.run(fetch())
    assert hosts[2:] == ["api.met.no"]  # paused: straight to the backup


# --- farms ---------------------------------------------------------------------------------------


def test_own_farm_dashboard_works_without_any_forecast():
    sources = seeded_sources()
    # GPM-style observed rain up to yesterday, and no forecast at all.
    sources["open_meteo"] = Canned("open_meteo", [])
    sources["nasa_power"] = Canned("nasa_power", sources["nasa_power"]._obs + obs("nasa_power", "precipitation", range(-3, 0), 2.0))
    pipeline = make_pipeline(sources)
    farm = parse_farm_id("my_25.6512_88.7021_maize")
    asyncio.run(pipeline.refresh_location(farm.location, list(sources)))
    d = build_custom_dashboard(farm, pipeline, now=NOW)
    assert d.forecast == [] and [m.data_source for m in d.modules] == ["live", "live", "live"]


# --- map grid --------------------------------------------------------------------------------------


def test_grid_weather_uses_a_coarser_lattice():
    cells = grid.land_cells()
    points, owner = grid.weather_points(cells)
    assert len(points) * 3 < len(cells)  # at least 3x fewer Open-Meteo locations
    assert len(owner) == len(cells) and max(owner) == len(points) - 1
    for (lat, lon), o in zip(cells, owner, strict=True):
        assert abs(points[o][0] - lat) <= 0.2 + 1e-9 and abs(points[o][1] - lon) <= 0.2 + 1e-9


def test_grid_keeps_its_last_weather_when_open_meteo_refuses():
    pipeline = make_pipeline({})
    cells = grid.land_cells()[:3]
    old = {"days": ["2026-09-30"], "rain": [[1.0]] * 3, "tmax": [[30.0]] * 3, "tmean": [[27.0]] * 3, "humidity": [[80.0]] * 3}
    pipeline.store.cache_set("grid_weather_v3", old, NOW - timedelta(hours=12))  # expired

    async def go():
        async with client_for(lambda r: httpx2.Response(429)) as client:
            return await grid._weather(pipeline, client, cells)

    assert asyncio.run(go()) == old
    assert grid._weather_paused_until is not None
