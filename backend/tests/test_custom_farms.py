import asyncio
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.data.places import DISTRICTS, DIVISIONS, nearest_district
from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.models import Observation
from app.pipeline.service import PipelineService
from app.pipeline.store import ObservationStore
from app.risk.grid import in_bangladesh
from app.services import custom_farms
from app.services.custom_farms import FAST_SOURCES, SLOW_SOURCES, CustomFarmError, ensure_data, make_farm_id, parse_farm_id
from app.services.dashboard import FarmDataPendingError, build_custom_dashboard

NOW = datetime(2026, 10, 1, 6, tzinfo=UTC)
TODAY = date(2026, 10, 1)
DINAJPUR_MAIZE = "my_25.6512_88.7021_maize"


class Canned:
    """A fake NASA source that records which places it was asked for."""

    def __init__(self, source_id: str, observations: list[Observation]):
        from app.pipeline.sources.base import SourceInfo

        self.info = SourceInfo(source_id, "T", "t", "t", (), False, 6, 0)
        self.token = "t"
        self._obs = observations
        self.calls: list[str] = []

    async def fetch(self, client, location, start, end):
        self.calls.append(location.id)
        return self._obs


def obs(src, var, offsets, value):
    return [Observation(src, var, TODAY + timedelta(days=o), value, "x") for o in offsets]


def seeded_sources() -> dict[str, Canned]:
    data = {
        "nasa_power": obs("nasa_power", "precipitation", range(-40, 0), 2.0)
        + obs("nasa_power", "soil_wetness", range(-40, 0), 0.4)
        + obs("nasa_power", "root_zone_wetness", range(-40, 0), 0.5)
        + obs("nasa_power", "temperature_max", range(-40, 0), 31.0)
        + obs("nasa_power", "temperature_mean", range(-40, 0), 27.0)
        + obs("nasa_power", "humidity", range(-40, 0), 80.0),
        "open_meteo": obs("open_meteo", "precipitation_forecast", range(-3, 8), 1.0)
        + obs("open_meteo", "temperature_max_forecast", range(-3, 8), 32.0)
        + obs("open_meteo", "temperature_min_forecast", range(-3, 8), 24.0),
        "srtm": [Observation("srtm", "elevation", date(2000, 2, 11), 30.0, "m")],
        "power_climatology": [Observation("power_climatology", "precipitation_normal", date(2001, m, 1), 6.0, "mm/day") for m in range(1, 13)],
        **{s: [] for s in SLOW_SOURCES},
    }
    return {k: Canned(k, v) for k, v in data.items()}


def make_pipeline(sources: dict[str, Canned]) -> PipelineService:
    return PipelineService(ObservationStore(":memory:"), list(sources.values()), now=lambda: NOW)


def load(pipeline: PipelineService, farm_id: str):
    """ensure_data, then wait for the background work so tests stay deterministic."""

    async def run():
        await ensure_data(pipeline, parse_farm_id(farm_id))
        await asyncio.gather(*custom_farms._background.values())

    asyncio.run(run())
    custom_farms._background.clear()


# --- places ---------------------------------------------------------------------------------


def test_all_64_district_towns_lie_inside_bangladesh_and_in_a_known_division():
    assert len(DISTRICTS) == 64 and len(DIVISIONS) == 8
    assert all(in_bangladesh(d.lat, d.lon) for d in DISTRICTS)
    assert all(d.division in DIVISIONS for d in DISTRICTS)


def test_nearest_district_town():
    district, km = nearest_district(24.86, 89.36)
    assert district.name == "Bogura" and km < 3


# --- ids --------------------------------------------------------------------------------------


def test_farm_id_round_trips_and_names_the_place():
    farm_id = make_farm_id(25.65123, 88.70214, "maize")
    assert farm_id == DINAJPUR_MAIZE
    farm = parse_farm_id(farm_id)
    assert (farm.crop.name, farm.district.name, farm.division.name) == ("Maize", "Dinajpur", "Rangpur")
    # Nearby fields share one ~1 km data point.
    assert farm.location == parse_farm_id("my_25.6489_88.7031_wheat").location


@pytest.mark.parametrize(
    ("farm_id", "message"),
    [
        ("my_25.6_88.7", "valid"),
        ("my_25.6512_88.7021_coffee", "Unknown crop"),
        ("my_22.5000_88.3000_boro-rice", "Unknown crop"),  # Kolkata: plain crop names outside Bangladesh
        ("my_80.0000_10.0000_wheat", "poles"),
        ("sunamganj-haor", "valid"),
    ],
)
def test_bad_farm_ids_are_rejected(farm_id, message):
    with pytest.raises(CustomFarmError, match=message):
        parse_farm_id(farm_id)


# --- data -------------------------------------------------------------------------------------


def test_new_field_fetches_quick_sources_now_and_satellites_in_the_background():
    sources = seeded_sources()
    pipeline = make_pipeline(sources)
    load(pipeline, DINAJPUR_MAIZE)
    point = parse_farm_id(DINAJPUR_MAIZE).location.id
    assert all(sources[s].calls == [point] for s in FAST_SOURCES + SLOW_SOURCES)

    # A second visit within the cache lifetime downloads nothing.
    load(pipeline, DINAJPUR_MAIZE)
    assert all(len(s.calls) == 1 for s in sources.values())


def test_custom_dashboard_is_fully_live_with_the_crop_profile_and_name():
    pipeline = make_pipeline(seeded_sources())
    load(pipeline, DINAJPUR_MAIZE)
    d = build_custom_dashboard(parse_farm_id(DINAJPUR_MAIZE), pipeline, now=NOW)
    assert d.farm.custom and d.farm.area_acres is None
    assert (d.farm.name, d.farm.district, d.farm.division, d.farm.crop) == ("My maize field", "Dinajpur", "Rangpur", "Maize")
    assert [m.data_source for m in d.modules] == ["live", "live", "live"]
    crop = next(m for m in d.modules if m.id == "crop_health")
    assert crop.indicators.disease == "northern leaf blight" and crop.indicators.heat_limit_c == 35
    assert len(d.forecast) == 7 and d.recommendations
    assert build_custom_dashboard(parse_farm_id(DINAJPUR_MAIZE), pipeline, "উত্তরের জমি", now=NOW).farm.name == "উত্তরের জমি"


def test_custom_dashboard_waits_for_data_instead_of_inventing_it():
    with pytest.raises(FarmDataPendingError):
        build_custom_dashboard(parse_farm_id(DINAJPUR_MAIZE), make_pipeline({}), now=NOW)


# --- API ----------------------------------------------------------------------------------------


def test_places_crops_and_locate(monkeypatch):
    from app.api.v1.endpoints import places as places_endpoint
    from app.services.geocode import Place

    async def kolkata(pipeline, lat, lon, lang):
        return Place("Kolkata", "India", True)

    monkeypatch.setattr(places_endpoint, "reverse_geocode", kolkata)
    client = TestClient(create_app())
    places = client.get("/api/v1/places").json()
    assert len(places["divisions"]) == 8 and len(places["districts"]) == 64
    assert {"name": "Bogura", "name_bn": "বগুড়া", "lat": 24.85, "lon": 89.37, "division": "Rajshahi"} in places["districts"]

    crops = client.get("/api/v1/crops").json()
    assert [c["id"] for c in crops][:3] == ["boro-rice", "aman-rice", "aus-rice"]
    assert {c["scene"] for c in crops} == {"rice", "wheat", "potato"}

    here = client.get("/api/v1/locate", params={"lat": 25.6512, "lon": 88.7021}).json()
    assert here["inside"] and here["district"]["name"] == "Dinajpur" and here["division"]["name_bn"] == "রংপুর"
    assert client.get("/api/v1/locate", params={"lat": 22.5, "lon": 88.3}).json() == {
        "lat": 22.5, "lon": 88.3, "inside": False, "district": None, "division": None, "km_to_district_town": None,
        "place": "Kolkata", "country": "India", "land": True,
    }
    world = client.get("/api/v1/crops", params={"region": "world"}).json()
    assert [c["id"] for c in world][:2] == ["rice", "wheat"] and world[0]["name_bn"] == "ধান"


def test_custom_farm_needs_live_mode_and_a_valid_id():
    client = TestClient(create_app())  # tests run in sample mode
    assert client.get(f"/api/v1/farms/{DINAJPUR_MAIZE}/dashboard").status_code == 409
    assert client.get("/api/v1/farms/my_22.5000_88.3000_boro-rice/dashboard").json()["detail"] == "Unknown crop 'boro-rice'."


def test_custom_farm_dashboard_and_assistant_in_live_mode():
    app = create_app()
    pipeline = make_pipeline(seeded_sources())
    app.dependency_overrides[get_settings] = lambda: Settings(data_mode="live", anthropic_api_key="")
    app.dependency_overrides[get_pipeline] = lambda: pipeline
    client = TestClient(app)

    res = client.get(f"/api/v1/farms/{DINAJPUR_MAIZE}/dashboard", params={"name": "North field"})
    assert res.status_code == 200
    body = res.json()
    assert body["farm"]["name"] == "North field" and body["farm"]["custom"] is True

    chat = client.post(
        "/api/v1/assistant/chat",
        json={"farm_id": DINAJPUR_MAIZE, "farm_name": "North field", "lang": "en", "messages": [{"role": "user", "content": "hello"}]},
    )
    assert chat.status_code == 200 and "Dinajpur" in chat.text
    custom_farms._background.clear()
