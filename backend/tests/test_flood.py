import asyncio
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.models import Location, Observation
from app.pipeline.service import PipelineService
from app.pipeline.store import ObservationStore
from app.risk.flood import DailyRain, FloodInputs, assess_flood, flood_trend, score_factors
from app.risk.grid import in_bangladesh, land_cells
from app.risk.inputs import flood_inputs
from app.risk.live import live_flood, wmo_condition
from app.services.dashboard import build_dashboard

TODAY = date(2026, 10, 1)
HAOR = Location("sunamganj-haor", 25.03, 91.25)


def rain_days(values: dict[int, float], source="open_meteo") -> list[DailyRain]:
    """values: {day offset from TODAY: mm}"""
    return [DailyRain(TODAY + timedelta(days=o), mm, source, o > 0) for o, mm in sorted(values.items())]


def inputs(rain=None, saturation=0.5, elevation=20.0, normal=10.0, saturation_source="smap") -> FloodInputs:
    return FloodInputs(
        rain=rain if rain is not None else rain_days({0: 5}),
        saturation=saturation,
        saturation_source=saturation_source,
        saturation_date=TODAY,
        normal_mm_per_day=normal,
        elevation_m=elevation,
    )


# --- engine --------------------------------------------------------------------------------


def test_extreme_rain_on_saturated_low_land_is_danger():
    storm = rain_days({-2: 60, -1: 50, 0: 40, 1: 80, 2: 90, 3: 60})
    a = assess_flood(inputs(rain=storm, saturation=0.95, elevation=6, normal=10), TODAY)
    assert a.level == "danger" and a.score >= 75
    assert a.confidence == "high"
    assert "Heaviest rain expected Saturday (90 mm)" in a.headline  # 3 Oct 2026 is a Saturday
    assert a.advice[0][0] == "high"


def test_dry_weather_caps_risk_even_on_low_wet_land():
    a = assess_flood(inputs(rain=rain_days({-1: 2, 1: 1}), saturation=1.0, elevation=5, normal=2), TODAY)
    assert a.score <= 45
    assert a.level in ("safe", "watch")


def test_each_factor_is_scored_on_its_own_scale():
    _, factors, past, future = score_factors(inputs(rain=rain_days({-1: 50, 2: 50}), saturation=0.9, elevation=8, normal=5), TODAY)
    by_id = {f.id: f for f in factors}
    assert (past, future) == (50, 50)
    assert by_id["rain"].score == 50  # 100 mm of the 200 mm "extreme"
    assert by_id["saturation"].score == 100  # 90% saturated
    assert by_id["terrain"].score == 100  # 8 m
    assert by_id["anomaly"].score == 21  # 50 mm this week vs a 35 mm normal = 1.4× (3× normal scores 100)
    assert by_id["anomaly"].label == "Unusually wet"


def test_anomaly_compares_the_week_with_the_monthly_normal():
    week = rain_days({o: 20 for o in range(-6, 1)})  # 140 mm this week
    _, factors, *_ = score_factors(inputs(rain=week, normal=10), TODAY)  # normal week: 70 mm → ×2
    anomaly = next(f for f in factors if f.id == "anomaly")
    assert anomaly.score == 50
    assert "2.0× the normal rain for October" in anomaly.detail


def test_missing_inputs_lower_confidence_instead_of_guessing():
    a = assess_flood(inputs(saturation=None, normal=None), TODAY)
    assert {f.id for f in a.factors} == {"rain", "terrain"}
    assert a.confidence == "low"
    stand_in = assess_flood(inputs(saturation_source="nasa_power"), TODAY)
    assert stand_in.confidence == "medium"


def test_safe_explanations_reassure_instead_of_alarming():
    # Dry week, soil not full, but very low land: overall safe, with a gentle heads-up.
    a = assess_flood(inputs(rain=rain_days({0: 1}), saturation=0.45, elevation=8), TODAY)
    assert a.level == "safe"
    assert a.explanation.startswith("Little rain is around")
    assert "low-lying" in a.explanation


def test_trend_recomputes_each_day_with_the_rain_around_it():
    storm = rain_days({-10: 80, -9: 80, 0: 0})
    trend = flood_trend(inputs(rain=storm, saturation=0.9, elevation=8), TODAY)
    assert len(trend) == 14
    assert max(trend[:6]) > trend[-1]  # the storm 10 days ago shows up, then fades


@pytest.mark.parametrize(("code", "rain", "condition"), [(0, 0, "sunny"), (2, 0, "partly_cloudy"), (3, 0, "cloudy"), (61, 3, "rain"), (3, 12, "rain"), (95, 20, "storm")])
def test_wmo_codes_map_to_friendly_conditions(code, rain, condition):
    assert wmo_condition(code, rain) == condition


# --- inputs from the pipeline -------------------------------------------------------------------


class Canned:
    """Minimal source that returns canned observations."""

    def __init__(self, source_id, observations):
        from app.pipeline.sources.base import SourceInfo

        self.info = SourceInfo(source_id, "T", "t", "t", (), False, 6, 0)
        self.token = "t"
        self._obs = observations

    async def fetch(self, client, location, start, end):
        return self._obs


def pipeline_with(observations_by_source: dict[str, list[Observation]]) -> PipelineService:
    sources = [Canned(sid, obs) for sid, obs in observations_by_source.items()]
    now = datetime(2026, 10, 1, 6, tzinfo=UTC)
    service = PipelineService(ObservationStore(":memory:"), sources, now=lambda: now)
    asyncio.run(service.refresh([HAOR], days=30))
    return service


def obs(source, variable, offset, value, unit="x"):
    return Observation(source, variable, TODAY + timedelta(days=offset), value, unit)


def test_inputs_prefer_observed_rain_and_smap_then_fill_from_forecast():
    pipe = pipeline_with(
        {
            "nasa_power": [obs("nasa_power", "precipitation", -3, 10.0), obs("nasa_power", "soil_wetness", -3, 0.6)],
            "open_meteo": [obs("open_meteo", "precipitation_forecast", d, 7.0) for d in range(-3, 4)],
            "smap": [obs("smap", "soil_moisture", -1, 0.40)],
            "srtm": [Observation("srtm", "elevation", date(2000, 2, 11), 8.0, "m")],
            "power_climatology": [Observation("power_climatology", "precipitation_normal", date(2001, 10, 1), 7.5, "mm/day")],
        }
    )
    i = flood_inputs(pipe, HAOR, TODAY)
    by_day = {r.date: r for r in i.rain}
    assert by_day[TODAY - timedelta(days=3)].source == "nasa_power" and by_day[TODAY - timedelta(days=3)].mm == 10.0
    assert by_day[TODAY - timedelta(days=1)].source == "open_meteo"  # POWER lags; forecast fills
    assert by_day[TODAY + timedelta(days=2)].forecast is True
    assert (i.saturation, i.saturation_source) == (pytest.approx(0.8), "smap")  # 0.40 m³/m³ ÷ 0.50 porosity
    assert (i.elevation_m, i.normal_mm_per_day) == (8.0, 7.5)


def test_inputs_fall_back_to_power_wetness_when_smap_is_stale():
    pipe = pipeline_with(
        {
            "nasa_power": [obs("nasa_power", "soil_wetness", -3, 0.62)],
            "smap": [obs("smap", "soil_moisture", -10, 0.4)],  # older than 5 days
        }
    )
    i = flood_inputs(pipe, HAOR, TODAY)
    assert (i.saturation, i.saturation_source) == (0.62, "nasa_power")


def test_live_flood_needs_recent_rain_data():
    assert live_flood(pipeline_with({"srtm": [Observation("srtm", "elevation", date(2000, 2, 11), 8.0, "m")]}), HAOR, TODAY) is None


def test_live_dashboard_uses_the_engine_and_falls_back_to_the_demo():
    pipe = pipeline_with({"open_meteo": [obs("open_meteo", "precipitation_forecast", d, 40.0) for d in range(-3, 7)]})
    live = build_dashboard("sunamganj-haor", "live", now=datetime(2026, 10, 1, 0, tzinfo=UTC), pipeline=pipe)
    flood = next(m for m in live.modules if m.id == "flood_risk")
    assert flood.data_source == "live" and flood.factors
    assert all(r.id.startswith("flood-") for r in live.recommendations if r.module == "flood_risk")
    assert next(m for m in live.modules if m.id == "water_stress").data_source == "sample"

    empty = pipeline_with({})
    fallback = build_dashboard("sunamganj-haor", "live", pipeline=empty)
    assert next(m for m in fallback.modules if m.id == "flood_risk").data_source == "sample"


# --- grid ----------------------------------------------------------------------------------------


def test_grid_is_clipped_to_bangladesh():
    assert in_bangladesh(23.81, 90.41) and not in_bangladesh(22.57, 88.36)  # Dhaka vs Kolkata
    cells = land_cells()
    assert 250 < len(cells) < 400
    assert all(in_bangladesh(lat, lon) for lat, lon in cells)


# --- API -----------------------------------------------------------------------------------------


def test_flood_endpoint():
    pipe = pipeline_with(
        {
            "open_meteo": [obs("open_meteo", "precipitation_forecast", d, 30.0) for d in range(-3, 7)],
            "srtm": [Observation("srtm", "elevation", date(2000, 2, 11), 8.0, "m")],
        }
    )
    app = create_app()
    app.dependency_overrides[get_pipeline] = lambda: pipe
    client = TestClient(app)
    body = client.get("/api/v1/farms/sunamganj-haor/flood").json()
    assert body["level"] in ("watch", "warning", "danger")
    assert {f["id"] for f in body["factors"]} == {"rain", "terrain"}
    assert body["inputs"]["elevation_m"] == 8.0
    assert body["advice"]
    assert client.get("/api/v1/farms/nowhere/flood").status_code == 404

    app.dependency_overrides[get_pipeline] = lambda: pipeline_with({})
    assert TestClient(app).get("/api/v1/farms/sunamganj-haor/flood").status_code == 503
