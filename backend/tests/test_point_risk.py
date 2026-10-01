import asyncio
import re

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.pipeline.store import ObservationStore
from app.services import custom_farms, geocode as geo, point_risk as pr
from app.risk.region import local_today
from app.services.geocode import Place, reverse_geocode
from app.services.point_risk import PointRiskError, point_location, point_risk
from tests.test_custom_farms import NOW, make_pipeline, seeded_sources

NAIROBI = (-1.29, 36.82)


async def fake_geocode(pipeline, lat, lon, lang):
    return Place("Kiambu" if lang == "en" else "কিয়াম্বু", "Kenya" if lang == "en" else "কেনিয়া", True)


async def sea(pipeline, lat, lon, lang):
    return Place(None, None, False)


def run(pipeline, *args, geocode=fake_geocode, **kwargs):
    async def go():
        result = await point_risk(pipeline, *args, now=NOW, geocode=geocode, **kwargs)
        await asyncio.gather(*custom_farms._background.values())
        return result

    try:
        return asyncio.run(go())
    finally:
        custom_farms._background.clear()


def test_nearby_taps_share_one_point_and_the_map_can_wrap():
    assert point_location(-1.291, 36.822) == point_location(-1.31, 36.81)
    assert point_location(-1.29, 36.82).id == "pt_-1.30_36.80"
    assert local_today(NOW, -120.0).isoformat() == "2026-09-30"  # 06:00 UTC is still yesterday in California
    assert local_today(NOW, 90.4).isoformat() == "2026-10-01"


def test_any_land_spot_gets_all_three_live_risks():
    sources = seeded_sources()
    result = run(make_pipeline(sources), *NAIROBI, "maize")
    assert (result.place, result.country, result.land, result.in_bangladesh, result.crop) == ("Kiambu", "Kenya", True, False, "Maize")
    assert [m.id for m in result.modules] == ["flood_risk", "water_stress", "crop_health"]
    assert all(m.data_source == "live" for m in result.modules)
    assert result.overall is not None and result.overall.score >= max(m.score for m in result.modules)
    assert 1 <= len(result.recommendations) <= 3
    # Quick sources answered for the snapped point; satellites were started too.
    assert sources["nasa_power"].calls == ["pt_-1.30_36.80"] and sources["modis"].calls == ["pt_-1.30_36.80"]


def test_open_water_has_no_risks_and_downloads_nothing():
    sources = seeded_sources()
    result = run(make_pipeline(sources), 30.0, -40.0, geocode=sea)
    assert result.land is False and result.modules == [] and result.overall is None
    assert all(s.calls == [] for s in sources.values())


@pytest.mark.parametrize(("lat", "crop", "message"), [(-1.3, "coffee", "Unknown crop"), (-75.0, "rice", "poles")])
def test_unsupported_requests(lat, crop, message):
    with pytest.raises(PointRiskError, match=message):
        run(make_pipeline(seeded_sources()), lat, 36.8, crop)


def test_reverse_geocode_names_the_place_caches_it_and_spots_the_sea(monkeypatch):
    monkeypatch.setattr(geo, "_last_geocode", 0.0)
    monkeypatch.setattr(geo, "_geocode_paused_until", None)
    calls = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        calls.append(request)
        if float(request.url.params["lat"]) > 20:
            return httpx2.Response(200, json={"error": "Unable to geocode"})
        return httpx2.Response(200, json={"address": {"town": "Kiambu", "state": "Kiambu County", "country": "Kenya"}})

    pipeline = PipelineService(
        ObservationStore(":memory:"), [], client_factory=lambda: httpx2.AsyncClient(transport=httpx2.MockTransport(handler)), now=lambda: NOW
    )
    assert asyncio.run(reverse_geocode(pipeline, *NAIROBI, "bn")) == Place("Kiambu", "Kenya", True)
    assert asyncio.run(reverse_geocode(pipeline, *NAIROBI, "bn")) == Place("Kiambu", "Kenya", True)
    assert len(calls) == 1  # cached
    assert calls[0].url.params["accept-language"] == "bn,en"
    assert "FarmShield" in calls[0].headers["user-agent"]
    assert asyncio.run(reverse_geocode(pipeline, 30.0, -40.0, "en")) == Place(None, None, False)


def test_reverse_geocode_failure_is_quick_and_pauses_lookups(monkeypatch):
    monkeypatch.setattr(geo, "_last_geocode", 0.0)
    monkeypatch.setattr(geo, "_geocode_paused_until", None)
    real_sleep = asyncio.sleep
    monkeypatch.setattr(asyncio, "sleep", lambda *_: real_sleep(0))
    pipeline = PipelineService(
        ObservationStore(":memory:"), [], client_factory=lambda: httpx2.AsyncClient(transport=httpx2.MockTransport(lambda r: httpx2.Response(503))), now=lambda: NOW
    )
    calls = []
    pipeline.client_factory = lambda: httpx2.AsyncClient(transport=httpx2.MockTransport(lambda r: calls.append(r) or httpx2.Response(503)))
    assert asyncio.run(reverse_geocode(pipeline, *NAIROBI, "en")) is None
    assert len(calls) == 1  # no retries
    # While paused, taps don't even ask.
    assert asyncio.run(reverse_geocode(pipeline, 10.0, 10.0, "en")) is None
    assert len(calls) == 1


def test_slow_geocoder_is_abandoned(monkeypatch):
    monkeypatch.setattr(geo, "_last_geocode", 0.0)
    monkeypatch.setattr(geo, "_geocode_paused_until", None)
    monkeypatch.setattr(geo, "GEOCODE_TIMEOUT_S", 0.05)
    real_sleep = asyncio.sleep

    async def slow(request):
        await real_sleep(1)
        return httpx2.Response(200, json={})

    pipeline = PipelineService(ObservationStore(":memory:"), [], client_factory=lambda: httpx2.AsyncClient(transport=httpx2.MockTransport(slow)), now=lambda: NOW)
    assert asyncio.run(reverse_geocode(pipeline, *NAIROBI, "en")) is None


# --- API ----------------------------------------------------------------------------------------


@pytest.fixture
def live_client(monkeypatch):
    monkeypatch.setattr(pr, "reverse_geocode", fake_geocode)
    monkeypatch.setattr("app.api.v1.endpoints.map.point_risk", lambda *a, **k: point_risk(*a, **k, now=NOW, geocode=fake_geocode))
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(data_mode="live", earthdata_token="")
    app.dependency_overrides[get_pipeline] = lambda: make_pipeline(seeded_sources())
    yield TestClient(app)
    custom_farms._background.clear()


def test_point_api_in_english_and_bengali(live_client):
    en = live_client.get("/api/v1/map/point", params={"lat": -1.29, "lon": 36.82, "crop": "maize"}).json()
    assert (en["place"], en["crop"], en["land"]) == ("Kiambu", "Maize", True)
    assert [m["title"] for m in en["modules"]] == ["Flood risk", "Water stress", "Crop health"]

    bn = live_client.get("/api/v1/map/point", params={"lat": -1.29, "lon": 36.82 + 360, "crop": "maize", "lang": "bn"}).json()
    assert (bn["place"], bn["country"], bn["crop"], bn["lon"]) == ("কিয়াম্বু", "কেনিয়া", "ভুট্টা", 36.8)
    texts = [bn["overall"]["summary"]] + [m["headline"] for m in bn["modules"]] + [r["title"] for r in bn["recommendations"]]
    assert [t for t in texts if re.search("[A-Za-z]", t)] == []


def test_point_api_errors(live_client):
    assert live_client.get("/api/v1/map/point", params={"lat": -1.29, "lon": 36.82, "crop": "coffee"}).status_code == 422
    demo = TestClient(create_app()).get("/api/v1/map/point", params={"lat": -1.29, "lon": 36.82})
    assert demo.status_code == 409 and "demo" in demo.json()["detail"]
