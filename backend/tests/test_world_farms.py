"""Stage B: farms anywhere on Earth, with per-region tuning."""

import asyncio
import re
from datetime import date, timedelta

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.assistant.facts import _farm_line
from app.core.config import Settings, get_settings
from app.i18n import translate
from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.models import Location, Observation
from app.pipeline.service import PipelineService, SeriesPoint, VariableSeries
from app.pipeline.sources.static import SrtmElevationSource
from app.pipeline.store import ObservationStore
from app.risk.flood import FloodInputs, relief_words, score_factors
from app.risk.inputs import POROSITY, soil_porosity
from app.services import custom_farms, farm_access, geocode
from app.services.custom_farms import CustomFarmError, parse_farm_id
from app.services.geocode import Place, search_places
from tests.test_custom_farms import NOW, TODAY, Canned, make_pipeline, seeded_sources

LATIN = re.compile(r"[A-Za-z]")
KENYA_MAIZE = "my_-1.2900_36.8200_maize"


def client_for(handler) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(transport=httpx2.MockTransport(handler))


# --- terrain: height above the lowest land nearby -------------------------------------------------


def test_srtm_reads_the_field_and_eight_neighbours_in_one_request():
    seen = []

    def handler(request):
        seen.append(request.url.params["locations"].split("|"))
        return httpx2.Response(200, json={"results": [{"elevation": e} for e in (1510, 1507, 1530, 1540, 1525, 1520, 1512, 1550, 1560)]})

    async def go():
        async with client_for(handler) as client:
            return await SrtmElevationSource().fetch(client, Location("k", -1.29, 36.82), TODAY, TODAY)

    obs = {o.variable: o.value for o in asyncio.run(go())}
    assert len(seen[0]) == 9 and seen[0][0] == "-1.29,36.82"
    assert obs == {"elevation": 1510.0, "height_above_low": 3.0}  # 1510 m high, but only 3 m above the valley floor


def test_relative_height_drives_flood_terrain_outside_bangladesh():
    base = dict(rain=[], saturation=None, saturation_source=None, saturation_date=None, normal_mm_per_day=None, elevation_m=1510.0)

    def terrain(**kw):
        return next(f for f in score_factors(FloodInputs(**base, **kw), TODAY)[1] if f.id == "terrain")

    assert terrain().score == 0  # 1510 m above sea level: the delta rule says "safe"...
    low = terrain(relief_m=2.0)
    assert low.score == 100 and low.detail == "The field sits 2 m above the lowest land nearby, where water collects first"
    assert terrain(relief_m=30.0).score == 0
    for words in (relief_words(2.0), relief_words(30.0), relief_words(10.0)):
        assert not LATIN.search(translate(words, "bn"))


# --- soil: porosity calibrated from SMAP and POWER -------------------------------------------------


def _soil_obs(smap: float, wetness: float, days: int = 5) -> list[VariableSeries]:
    def points(value: float):
        return [SeriesPoint(TODAY - timedelta(days=i), value, "x", "good") for i in range(days)]

    return [VariableSeries("soil_moisture", "", "", "", points(smap)), VariableSeries("soil_wetness", "", "", "", points(wetness))]


def test_soil_porosity_is_calibrated_outside_bangladesh_only():
    kenya, bogura = Location("k", -1.29, 36.82), Location("b", 24.85, 89.37)
    assert soil_porosity(_soil_obs(0.20, 0.50), bogura) == POROSITY  # home calibration kept
    assert soil_porosity(_soil_obs(0.20, 0.50), kenya) == pytest.approx(0.40)  # a sandier soil
    assert soil_porosity(_soil_obs(0.40, 0.50), kenya) == 0.60  # clamped
    assert soil_porosity(_soil_obs(0.20, 0.50, days=2), kenya) == POROSITY  # too few days to tell


# --- farm ids --------------------------------------------------------------------------------------


def test_world_farm_ids_and_crops():
    farm = parse_farm_id(KENYA_MAIZE)
    assert (farm.lat, farm.lon, farm.crop.name, farm.in_bangladesh) == (-1.29, 36.82, "Maize", False)
    assert parse_farm_id("my_40.4168_-3.7038_rice").crop.name == "Rice"  # Madrid: west of Greenwich
    with pytest.raises(CustomFarmError, match="Unknown crop"):
        parse_farm_id("my_24.8500_89.3700_rice")  # in Bangladesh, crops carry their season


# --- dashboard ---------------------------------------------------------------------------------------


@pytest.fixture
def live_client(monkeypatch):
    names = {"en": Place("Kiambu", "Kenya", True), "bn": Place("কিয়াম্বু", "কেনিয়া", True)}

    async def fake(pipeline, lat, lon, lang):
        return names[lang]

    monkeypatch.setattr(farm_access, "reverse_geocode", fake)
    sources = seeded_sources()
    sources["srtm"] = Canned(
        "srtm", [Observation("srtm", "elevation", date(2000, 2, 11), 1510.0, "m"), Observation("srtm", "height_above_low", date(2000, 2, 11), 3.0, "m")]
    )
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(data_mode="live", anthropic_api_key="")
    app.dependency_overrides[get_pipeline] = lambda: make_pipeline(sources)
    yield TestClient(app)
    custom_farms._background.clear()


def test_world_farm_dashboard_in_english_and_bengali(live_client):
    d = live_client.get(f"/api/v1/farms/{KENYA_MAIZE}/dashboard").json()
    farm = d["farm"]
    assert (farm["name"], farm["district"], farm["division"], farm["country"], farm["crop"]) == ("My maize field", "Kiambu", "Kenya", "Kenya", "Maize")
    assert farm["story"] == "Your field near Kiambu, Kenya, watched from space by NASA satellites."
    assert [m["data_source"] for m in d["modules"]] == ["live", "live", "live"]
    terrain = next(f for f in d["modules"][0]["factors"] if f["id"] == "terrain")
    # 1510 m up, yet on the valley floor: the relative rule, not the delta's sea-level rule.
    assert terrain["score"] == 100 and terrain["detail"] == "The field sits 3 m above the lowest land nearby, where water collects first"

    bn = live_client.get(f"/api/v1/farms/{KENYA_MAIZE}/dashboard", params={"lang": "bn"}).json()
    farm = bn["farm"]
    assert (farm["name"], farm["district"], farm["division"], farm["crop"]) == ("আমার ভুট্টার জমি", "কিয়াম্বু", "কেনিয়া", "ভুট্টা")
    texts = [farm["story"], bn["overall"]["summary"]] + [x for m in bn["modules"] for x in (m["headline"], m["explanation"])]
    texts += [f["detail"] for m in bn["modules"] for f in m["factors"]]
    assert [t for t in texts if LATIN.search(t.replace("NASA", "").replace("SRTM", ""))] == []


def test_world_farm_without_a_place_name_uses_coordinates(monkeypatch, live_client):
    async def offline(pipeline, lat, lon, lang):
        return None

    monkeypatch.setattr(farm_access, "reverse_geocode", offline)
    farm = live_client.get(f"/api/v1/farms/{KENYA_MAIZE}/dashboard").json()["farm"]
    assert (farm["district"], farm["division"], farm["country"]) == ("1.29°S, 36.82°E", "", None)


def test_assistant_knows_where_the_farm_is():
    from app.schemas.dashboard import Farm

    world = Farm(id="x", name="My maize field", district="Kiambu", division="Kenya", country="Kenya", crop="Maize", lat=-1.29, lon=36.82, story="", custom=True)
    home = Farm(id="y", name="Field", district="Bogura", division="Rajshahi", crop="Potato", lat=24.85, lon=89.37, story="", area_acres=2.5)
    assert _farm_line(world) == "Farm: My maize field, near Kiambu, Kenya. Crop: Maize."  # no size: never crashes
    assert _farm_line(home) == "Farm: Field, Bogura district, Rajshahi division, Bangladesh. Crop: Potato. Size: 2.5 acres."


# --- place search -----------------------------------------------------------------------------------


def test_place_search_parses_caches_and_reports_outages(monkeypatch):
    monkeypatch.setattr(geocode, "_last_geocode", 0.0)
    monkeypatch.setattr(geocode, "_geocode_paused_until", None)
    calls = []

    def handler(request):
        calls.append(request)
        return httpx2.Response(
            200,
            json=[
                {"name": "Kiambu", "lat": "-1.1714", "lon": "36.8356", "display_name": "Kiambu, Kenya", "address": {"town": "Kiambu", "state": "Kiambu County", "country": "Kenya"}},
                {"lat": "x"},  # malformed rows are skipped
            ],
        )

    pipeline = PipelineService(ObservationStore(":memory:"), [], client_factory=lambda: client_for(handler), now=lambda: NOW)
    found = asyncio.run(search_places(pipeline, "  kiambu  ", "en"))
    assert [(p.name, p.detail, p.lat, p.lon) for p in found] == [("Kiambu", "Kiambu County, Kenya", -1.1714, 36.8356)]
    asyncio.run(search_places(pipeline, "Kiambu", "en"))
    assert len(calls) == 1 and calls[0].url.params["q"] == "kiambu"


def test_place_search_endpoint(monkeypatch):
    from app.api.v1.endpoints import places as places_endpoint
    from app.services.geocode import FoundPlace

    results = {"value": [FoundPlace("Kiambu", "Kenya", "Kenya", -1.17, 36.84)]}

    async def fake(pipeline, q, lang):
        return results["value"]

    monkeypatch.setattr(places_endpoint, "search_places", fake)
    client = TestClient(create_app())
    assert client.get("/api/v1/places/search", params={"q": "Kiambu"}).json() == [
        {"name": "Kiambu", "detail": "Kenya", "country": "Kenya", "lat": -1.17, "lon": 36.84}
    ]
    results["value"] = None
    assert client.get("/api/v1/places/search", params={"q": "Kiambu"}).status_code == 503
    assert client.get("/api/v1/places/search", params={"q": "K"}).status_code == 422
