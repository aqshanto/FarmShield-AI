"""The served map: built once at a time, kept in memory, never a long wait."""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.services import map as map_service

real_build = map_service.build_map_overview
real_farm_dashboards = map_service._farm_dashboards


@pytest.fixture
def builds(monkeypatch):
    """A live build that takes `delay` seconds and is counted; the modelled map stays real."""
    state = {"count": 0, "delay": 0.0, "status": "live"}

    async def fake(data_mode, now=None, pipeline=None, grid_timeout=30):
        if pipeline is None:
            return await real_build(data_mode)
        state["count"] += 1
        await asyncio.sleep(state["delay"])
        overview = await real_build("sample")
        return overview.model_copy(update={"data_mode": "live", "grid_status": state["status"]})

    monkeypatch.setattr(map_service, "build_map_overview", fake)
    monkeypatch.setattr(map_service, "COLD_WAIT_S", 0.05)
    monkeypatch.setattr(map_service, "_farm_dashboards", lambda *args: [])  # the farms have their own test
    return state


PIPELINE = object()


def test_a_cold_visit_gets_the_modelled_map_at_once_then_the_live_one(builds):
    builds["delay"] = 0.3

    async def go():
        first = await map_service.get_map_overview("live", PIPELINE)
        await asyncio.sleep(0.4)
        second = await map_service.get_map_overview("live", PIPELINE)
        return first, second

    first, second = asyncio.run(go())
    assert first.grid_status == "warming" and not any(layer.live for layer in first.layers)
    assert second.grid_status == "live" and builds["count"] == 1


def test_while_warming_each_visit_shows_the_farms_whose_data_has_arrived(builds, monkeypatch):
    from tests.test_water import pipeline as pipeline_with_barind_data

    monkeypatch.setattr(map_service, "_farm_dashboards", real_farm_dashboards)
    builds["delay"] = 0.3
    builds["status"] = "warming"
    pipeline = pipeline_with_barind_data()

    async def go():
        cold = await map_service.get_map_overview("live", pipeline)
        await asyncio.sleep(0.4)
        cached = await map_service.get_map_overview("live", pipeline)
        return cold, cached

    cold, cached = asyncio.run(go())
    assert [f.id for f in cold.farms] == ["barind-wheat"] and cold.grid_status == "warming"
    assert [f.id for f in cached.farms] == ["barind-wheat"] and cached.grid_status == "warming"


def test_a_quick_build_is_simply_awaited(builds, monkeypatch):
    monkeypatch.setattr(map_service, "COLD_WAIT_S", 2.0)  # "quick" still builds the real modelled map, which a busy machine can slow
    overview = asyncio.run(map_service.get_map_overview("live", PIPELINE))
    assert overview.grid_status == "live"


def test_simultaneous_visits_share_one_build(builds, monkeypatch):
    builds["delay"] = 0.02
    monkeypatch.setattr(map_service, "COLD_WAIT_S", 2.0)  # every visit waits for the one build, however slow the machine

    async def go():
        return await asyncio.gather(*(map_service.get_map_overview("live", PIPELINE) for _ in range(5)))

    results = asyncio.run(go())
    assert builds["count"] == 1 and all(r.grid_status == "live" for r in results)


def test_fresh_maps_come_from_memory_and_old_ones_are_rebuilt_in_the_background(builds, monkeypatch):
    async def go():
        await map_service.get_map_overview("live", PIPELINE)
        await map_service.get_map_overview("live", PIPELINE)
        assert builds["count"] == 1  # fresh: no rebuild

        built_at, overview = map_service._cache[id(PIPELINE)]
        map_service._cache[id(PIPELINE)] = (built_at - timedelta(minutes=31), overview)
        served = await map_service.get_map_overview("live", PIPELINE)
        assert served is overview  # the old map is served at once...
        await asyncio.sleep(0.01)
        assert builds["count"] == 2  # ...while a new one was built
        assert datetime.now(UTC) - map_service._cache[id(PIPELINE)][0] < timedelta(seconds=5)

    asyncio.run(go())


def test_a_failed_live_grid_is_retried_sooner(builds):
    builds["status"] = "RateLimitedError: HTTP 429"

    async def go():
        await map_service.get_map_overview("live", PIPELINE)
        built_at, overview = map_service._cache[id(PIPELINE)]
        map_service._cache[id(PIPELINE)] = (built_at - timedelta(minutes=6), overview)
        await map_service.get_map_overview("live", PIPELINE)
        await asyncio.sleep(0.01)

    asyncio.run(go())
    assert builds["count"] == 2


def test_demo_mode_is_built_per_request(builds):
    overview = asyncio.run(map_service.get_map_overview("sample", None))
    assert overview.grid_status == "demo" and builds["count"] == 0 and map_service._cache == {}
