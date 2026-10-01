import asyncio
from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient

from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.models import Location, Observation
from app.pipeline.service import PipelineService
from app.pipeline.store import ObservationStore
from app.risk.flood import DailyRain
from app.risk.inputs import water_inputs
from app.risk.live import live_water, water_module
from app.risk.water import Reading, WaterInputs, assess_water, irrigation_action, score_factors, water_trend
from app.services.dashboard import build_dashboard

TODAY = date(2026, 10, 1)
FARM = Location("barind-wheat", 24.62, 88.56)


def day(offset: int) -> date:
    return TODAY + timedelta(days=offset)


def rain(values: dict[int, float] | None = None, default: float = 0.0, source="nasa_power") -> list[DailyRain]:
    values = values or {}
    return [DailyRain(day(o), values.get(o, default), source if o <= 0 else "open_meteo", o > 0) for o in range(-45, 8)]


def inputs(
    rain_series=None,
    surface: float | None = 0.6,
    surface_source="smap",
    root: float | None = 0.7,
    tmax: float = 32,
    normal: float = 5.0,
    ndvi: float | None = None,
    ndvi_normal: float = 0.8,
) -> WaterInputs:
    return WaterInputs(
        rain=rain_series if rain_series is not None else rain(default=5.0),
        surface={day(-1): Reading(surface, surface_source)} if surface is not None else {},
        root={day(-2): Reading(root, "nasa_power")} if root is not None else {},
        tmax={day(o): Reading(tmax, "nasa_power" if o <= 0 else "open_meteo") for o in range(-45, 8)},
        normals={m: normal for m in range(1, 13)},
        ndvi={day(-10): Reading(ndvi, "modis")} if ndvi is not None else {},
        ndvi_normal={day(-10): ndvi_normal},
    )


# --- engine -------------------------------------------------------------------------------------------


def test_drought_and_heat_is_danger_with_an_irrigate_today_action():
    a = assess_water(inputs(rain_series=rain(default=0.0), surface=0.15, root=0.3, tmax=41), TODAY)
    assert a.level == "danger" and a.status == "Very dry"
    assert a.action.kind == "irrigate" and a.action.title == "Irrigate today"
    assert a.advice[0][0] == "high"
    assert a.confidence == "high"


def test_rain_on_the_way_means_hold_irrigation():
    dry_then_rain = rain({1: 12, 2: 15}, default=0.0)
    a = assess_water(inputs(rain_series=dry_then_rain, surface=0.3, root=0.45, tmax=36), TODAY)
    assert a.level in ("watch", "warning", "danger")
    assert a.action.kind == "hold"
    assert "27 mm" in a.action.detail and "most on Saturday" in a.action.detail  # wettest day: 3 Oct 2026
    assert "hold off watering" in a.headline


def test_moist_soil_needs_no_irrigation():
    a = assess_water(inputs(surface=0.8, root=0.8, tmax=29), TODAY)
    assert a.level == "safe" and a.action.kind == "none"
    assert a.explanation.startswith("The soil and roots have enough water")


def test_factor_scales():
    _, factors = score_factors(inputs(rain_series=rain(default=2.5), surface=0.5, root=0.575, tmax=35, normal=5.0), TODAY)
    by = {f.id: f for f in factors}
    assert by["surface"].score == 50  # 50% wet on a 75% → 25% scale
    assert by["root"].score == 50
    assert by["shortfall"].score == 50  # half the normal rain
    assert "50% of normal" in by["shortfall"].detail
    assert by["heat"].score == 50  # 35 °C
    assert by["no_rain"].score == 58  # 12.5 mm expected in 5 days
    assert "plants" not in by  # no clear NDVI view


def test_plants_factor_compares_greenness_with_normal():
    _, factors = score_factors(inputs(ndvi=0.55, ndvi_normal=0.8), TODAY)
    plants = next(f for f in factors if f.id == "plants")
    assert plants.score == 100 and "0.25 below" in plants.detail


def test_a_recent_soaking_is_never_a_drought():
    soaked = rain({o: 40 for o in range(-6, 1)}, default=0.0)
    score, _ = score_factors(inputs(rain_series=soaked, surface=0.2, root=0.3, tmax=40), TODAY)
    assert score <= 24


def test_fresh_smap_is_preferred_over_newer_stand_in_readings():
    i = inputs()
    i.surface.clear()
    i.surface.update({day(-3): Reading(0.4, "smap"), day(-1): Reading(0.8, "nasa_power")})
    _, factors = score_factors(i, TODAY)
    surface = next(f for f in factors if f.id == "surface")
    assert surface.source == "smap" and "40% wet" in surface.detail


def test_missing_inputs_lower_confidence():
    assert assess_water(inputs(surface_source="nasa_power"), TODAY).confidence == "medium"
    few = assess_water(inputs(surface=None, root=None, rain_series=[]), TODAY)
    assert few.confidence == "low"


def test_days_since_good_rain_and_trend():
    a = assess_water(inputs(rain_series=rain({-12: 25}, default=0.0)), TODAY)
    assert a.days_since_good_rain == 12
    assert len(water_trend(inputs(), TODAY)) == 14


def test_irrigation_watch_level_suggests_checking_the_soil():
    assert irrigation_action("watch", inputs(rain_series=rain(default=0.0)), TODAY).kind == "check"


# --- pipeline → live module → dashboard / API ------------------------------------------------------------


class Canned:
    def __init__(self, source_id, observations):
        from app.pipeline.sources.base import SourceInfo

        self.info = SourceInfo(source_id, "T", "t", "t", (), False, 6, 0)
        self.token = "t"
        self._obs = observations

    async def fetch(self, client, location, start, end):
        return self._obs


def pipeline() -> PipelineService:
    obs = lambda src, var, offsets, value: [Observation(src, var, day(o), value, "x") for o in offsets]  # noqa: E731
    sources = {
        "nasa_power": obs("nasa_power", "precipitation", range(-40, -2), 0.5)
        + obs("nasa_power", "root_zone_wetness", range(-40, -2), 0.4)
        + obs("nasa_power", "soil_wetness", range(-40, -2), 0.35)
        + obs("nasa_power", "temperature_max", range(-40, -2), 37.0),
        "open_meteo": obs("open_meteo", "precipitation_forecast", range(-3, 7), 0.0) + obs("open_meteo", "temperature_max_forecast", range(-3, 7), 38.0),
        "smap": obs("smap", "soil_moisture", [-2], 0.12),
        "power_climatology": [Observation("power_climatology", "precipitation_normal", date(2001, m, 1), 6.0, "mm/day") for m in range(1, 13)],
    }
    now = datetime(2026, 10, 1, 6, tzinfo=UTC)
    service = PipelineService(ObservationStore(":memory:"), [Canned(k, v) for k, v in sources.items()], now=lambda: now)
    asyncio.run(service.refresh([FARM], days=60))
    return service


def test_inputs_from_pipeline_combine_smap_power_and_forecast():
    i = water_inputs(pipeline(), FARM, TODAY)
    assert i.surface[day(-2)] == Reading(0.24, "smap")  # 0.12 m³/m³ ÷ 0.50 porosity
    assert i.tmax[day(3)].source == "open_meteo" and i.tmax[day(-5)].source == "nasa_power"
    assert i.normals[10] == 6.0


def test_live_module_carries_status_action_and_metrics():
    live = live_water(pipeline(), FARM, TODAY)
    module = water_module(live)
    assert module.data_source == "live" and module.level in ("warning", "danger")
    assert module.status in ("Needs water soon", "Very dry")
    assert module.action.kind == "irrigate"
    assert module.metrics[0].label == "Topsoil wetness" and module.metrics[0].source == "SMAP"
    assert {f.id for f in module.factors} >= {"surface", "root", "shortfall", "heat", "no_rain"}


def test_dashboard_uses_live_water_module_and_advice():
    dash = build_dashboard("barind-wheat", "live", now=datetime(2026, 10, 1, 0, tzinfo=UTC), pipeline=pipeline())
    water = next(m for m in dash.modules if m.id == "water_stress")
    assert water.data_source == "live" and water.action is not None
    assert any(r.id.startswith("water-") for r in dash.recommendations)
    assert not any(r.id in ("r1", "r2", "r4") and r.module == "water_stress" for r in dash.recommendations)


def test_water_endpoint():
    app = create_app()
    app.dependency_overrides[get_pipeline] = pipeline
    client = TestClient(app)
    body = client.get("/api/v1/farms/barind-wheat/water").json()
    assert body["action"]["kind"] == "irrigate"
    assert body["status"] in ("Needs water soon", "Very dry")
    assert len(body["trend"]) == 14
    assert client.get("/api/v1/farms/nowhere/water").status_code == 404
