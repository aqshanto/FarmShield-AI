import asyncio
from datetime import UTC, date, datetime, timedelta

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.models import Location, Observation
from app.pipeline.service import PipelineService
from app.pipeline.sources.base import SourceError, SourceInfo, TokenRequiredError
from app.pipeline.store import ObservationStore

NOW = datetime(2026, 9, 30, 12, 0, tzinfo=UTC)
FARM = Location("barind-wheat", 24.62, 88.56)


class FakeSource:
    """Records the windows it was asked for and returns canned observations."""

    def __init__(self, source_id, variable="precipitation", values=None, error=None, ttl_hours=6, overlap_days=3, token="x", requires_token=False):
        self.info = SourceInfo(
            id=source_id,
            mission="TEST",
            provider="test",
            product="test",
            variables=(variable,),
            requires_token=requires_token,
            ttl_hours=ttl_hours,
            overlap_days=overlap_days,
        )
        self.variable = variable
        self.values = values or {}
        self.error = error
        self.token = token
        self.windows: list[tuple[date, date]] = []

    async def fetch(self, client, location, start, end):
        self.windows.append((start, end))
        if self.error:
            raise self.error
        return [Observation(self.info.id, self.variable, d, v, "mm/day") for d, v in self.values.items()]


def mock_client():
    return httpx2.AsyncClient(transport=httpx2.MockTransport(lambda r: httpx2.Response(500)))


def make_service(*sources, now=NOW):
    clock = {"now": now}
    service = PipelineService(ObservationStore(":memory:"), list(sources), client_factory=mock_client, now=lambda: clock["now"])
    return service, clock


def d(day: int) -> date:
    return date(2026, 9, day)


# --- store ------------------------------------------------------------------------------


def test_store_upserts_and_filters_rejected():
    store = ObservationStore(":memory:")
    store.upsert("f", [Observation("s", "ndvi", d(1), 0.5, "0–1"), Observation("s", "ndvi", d(2), 0.1, "0–1", "rejected")])
    store.upsert("f", [Observation("s", "ndvi", d(1), 0.6, "0–1")])  # revised value replaces
    assert [(r.date, r.value) for r in store.series("f", "ndvi", d(1), d(30))] == [(d(1), 0.6)]
    assert len(store.series("f", "ndvi", d(1), d(30), include_rejected=True)) == 2
    assert store.latest_date("s", "f") == d(2)
    assert store.counts() == {"s": 2}
    assert store.rejected_counts() == {"s": 1}


def test_store_cache_roundtrip():
    store = ObservationStore(":memory:")
    store.cache_set("k", [{"a": 1}], NOW)
    assert store.cache_get("k") == ([{"a": 1}], NOW)
    assert store.cache_get("missing") is None


# --- refresh ------------------------------------------------------------------------------


def test_refresh_stores_and_logs():
    source = FakeSource("rain", values={d(28): 4.0, d(29): 6.5})
    service, _ = make_service(source)
    [result] = asyncio.run(service.refresh([FARM], days=30))
    assert (result.status, result.count) == ("ok", 2)
    assert source.windows == [(date(2026, 8, 31), d(30))]
    assert service.store.last_fetch("rain", FARM.id).status == "ok"
    assert service.last_run() == {"finished_at": NOW.isoformat(), "ok": 1}


def test_fresh_data_is_not_downloaded_again():
    source = FakeSource("rain", values={d(28): 4.0}, ttl_hours=6)
    service, clock = make_service(source)
    asyncio.run(service.refresh([FARM]))
    clock["now"] = NOW + timedelta(hours=2)
    [again] = asyncio.run(service.refresh([FARM]))
    assert again.status == "skipped"
    assert len(source.windows) == 1

    [forced] = asyncio.run(service.refresh([FARM], force=True))
    assert forced.status == "ok" and len(source.windows) == 2


def test_refresh_is_incremental_with_overlap():
    source = FakeSource("rain", values={d(27): 1.0}, ttl_hours=1, overlap_days=3)
    service, clock = make_service(source)
    asyncio.run(service.refresh([FARM], days=60))
    clock["now"] = NOW + timedelta(hours=5)
    asyncio.run(service.refresh([FARM], days=60))
    # Second run restarts 3 days before the newest stored day, not 60 days back.
    assert source.windows[1] == (d(24), d(30))


def test_one_broken_source_never_stops_the_others():
    good = FakeSource("good", values={d(29): 2.0})
    broken = FakeSource("broken", error=SourceError("HTTP 503 from example"))
    locked = FakeSource("locked", error=TokenRequiredError("needs token"), requires_token=True)
    service, _ = make_service(good, broken, locked)
    results = {r.source: r for r in asyncio.run(service.refresh([FARM]))}
    assert results["good"].status == "ok"
    assert results["broken"].status == "error" and "503" in results["broken"].message
    assert results["locked"].status == "needs_token"


def test_source_status_summarises_each_source():
    good = FakeSource("good", values={d(29): 2.0})
    broken = FakeSource("broken", error=SourceError("boom"))
    no_token = FakeSource("mission", token=None, requires_token=True)
    service, _ = make_service(good, broken, no_token)
    asyncio.run(service.refresh([FARM]))
    status = {s["id"]: s for s in service.source_status()}
    assert status["good"]["state"] == "ok" and status["good"]["observations"] == 1
    assert status["broken"]["state"] == "error" and status["broken"]["message"] == "boom"
    assert status["mission"]["state"] == "needs_token"


# --- serving ------------------------------------------------------------------------------


def test_observations_prefer_mission_data_and_fill_gaps_from_the_stand_in():
    imerg = FakeSource("gpm_imerg", values={d(28): 14.0})
    power = FakeSource("nasa_power", values={d(27): 3.0, d(28): 9.0, d(29): 1.0})
    service, _ = make_service(imerg, power)
    asyncio.run(service.refresh([FARM]))
    rain = next(v for v in service.observations(FARM, days=30) if v.id == "precipitation")
    assert [(p.date, p.value, p.source) for p in rain.points] == [
        (d(27), 3.0, "nasa_power"),
        (d(28), 14.0, "gpm_imerg"),  # GPM wins where it has data
        (d(29), 1.0, "nasa_power"),
    ]
    assert rain.sources_used == ["gpm_imerg", "nasa_power"]


def test_vegetation_is_served_with_a_longer_lookback():
    modis = FakeSource("modis", variable="ndvi", values={date(2026, 6, 2): 0.7})
    service, _ = make_service(modis)
    asyncio.run(service.refresh([FARM]))
    ndvi = next(v for v in service.observations(FARM, days=30) if v.id == "ndvi")
    assert [p.value for p in ndvi.points] == [0.7]  # 120 days back, despite days=30


# --- API ------------------------------------------------------------------------------------


@pytest.fixture
def api():
    rain = FakeSource("nasa_power", values={d(28): 9.0, d(29): 1.0})
    service = PipelineService(ObservationStore(":memory:"), [rain], client_factory=cmr_client)
    asyncio.run(service.refresh([FARM], days=30))
    app = create_app()
    app.dependency_overrides[get_pipeline] = lambda: service
    return TestClient(app)


def cmr_client():
    def handler(request):
        return httpx2.Response(
            200, json={"feed": {"entry": [{"time_start": "2026-09-28T00:00:00.000Z", "title": "granule-1"}]}}
        )

    return httpx2.AsyncClient(transport=httpx2.MockTransport(handler))


def test_data_status_endpoint(api):
    body = api.get("/api/v1/data/status").json()
    assert body["token_configured"] is False
    assert body["sources"][0]["id"] == "nasa_power" and body["sources"][0]["state"] == "ok"
    assert {m["mission"] for m in body["missions"]} == {"SMAP", "GPM", "MODIS", "VIIRS"}
    assert body["missions"][0]["latest_granule"].startswith("2026-09-28")
    assert body["last_run"]["ok"] == 1 and body["last_run"]["skipped"] == 0


def test_farm_observations_endpoint(api):
    body = api.get("/api/v1/farms/barind-wheat/observations?days=30").json()
    rain = next(v for v in body["variables"] if v["id"] == "precipitation")
    assert [p["value"] for p in rain["points"]][-2:] == [9.0, 1.0]
    assert rain["latest"]["value"] == 1.0 and rain["latest"]["source"] == "nasa_power"
    smap = next(v for v in body["variables"] if v["id"] == "soil_moisture")
    assert smap["points"] == [] and smap["latest"] is None


def test_farm_observations_unknown_farm(api):
    assert api.get("/api/v1/farms/nowhere/observations").status_code == 404
    assert api.get("/api/v1/farms/barind-wheat/observations?days=2").status_code == 422


def test_refresh_endpoint_starts_background_job(api):
    response = api.post("/api/v1/data/refresh")
    assert response.status_code == 202
    assert response.json()["started"] is True
