import asyncio

from fastapi.testclient import TestClient

from app.data.sample.grid import BBOX, CELL_SIZE_DEG, cell_centres, risk_surface
from app.main import create_app
from app.services.map import build_map_overview

client = TestClient(create_app())


def _nearest(cells, lat, lon):
    return min(cells, key=lambda c: (c.lat - lat) ** 2 + (c.lon - lon) ** 2)


def test_cell_centres_cover_the_bbox_on_a_regular_grid():
    centres = cell_centres()
    cols = round((BBOX[2] - BBOX[0]) / CELL_SIZE_DEG)
    rows = round((BBOX[3] - BBOX[1]) / CELL_SIZE_DEG)
    assert len(centres) == rows * cols
    lats = sorted({lat for lat, _ in centres})
    assert all(abs((b - a) - CELL_SIZE_DEG) < 1e-6 for a, b in zip(lats, lats[1:], strict=False))
    assert BBOX[1] < lats[0] and lats[-1] < BBOX[3]


def test_surface_is_deterministic_and_bounded():
    surface = risk_surface("flood_risk", anchors=[])
    assert surface(24.9, 91.2) == surface(24.9, 91.2)
    for lat, lon in cell_centres():
        assert 0 <= surface(lat, lon) <= 100


def test_hotspots_land_in_the_right_regions():
    dash = asyncio.run(build_map_overview("sample"))
    haor = _nearest(dash.cells, 24.95, 91.2)
    barind = _nearest(dash.cells, 24.65, 88.5)
    centre = _nearest(dash.cells, 23.8, 90.4)  # Dhaka: none of the hotspots
    assert haor.flood_risk > centre.flood_risk + 20
    assert barind.water_stress > centre.water_stress + 20
    assert haor.water_stress < barind.water_stress


def test_map_agrees_with_farm_dashboards_near_each_farm():
    overview = asyncio.run(build_map_overview("sample"))
    for farm in overview.farms:
        cell = _nearest(overview.cells, farm.lat, farm.lon)
        for module_id, module in farm.modules.items():
            assert abs(getattr(cell, module_id) - module.score) <= 10, (farm.id, module_id)


def test_map_overview_endpoint():
    response = client.get("/api/v1/map/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["data_mode"] == "sample"
    assert [layer["id"] for layer in body["layers"]] == ["flood_risk", "water_stress", "crop_health"]
    assert len(body["cells"]) == len(cell_centres())
    assert {farm["id"] for farm in body["farms"]} == {"sunamganj-haor", "barind-wheat", "bogura-potato"}
    haor = next(f for f in body["farms"] if f["id"] == "sunamganj-haor")
    assert haor["modules"]["flood_risk"] == {"score": 78, "level": "danger"}


def test_live_grid_failure_is_reported_and_not_retried_on_every_visit(monkeypatch):
    import asyncio
    from datetime import UTC, datetime, timedelta

    from app.risk import grid
    from app.services import map as map_service

    monkeypatch.setattr(map_service, "_grid_failed", None)
    calls = []

    async def broken(*args, **kwargs):
        calls.append(1)
        raise RuntimeError("weather service said no")

    monkeypatch.setattr(grid, "live_grid", broken)
    now = datetime(2026, 10, 1, 6, tzinfo=UTC)
    pipeline = object()
    # The demo farms' own dashboards aren't under test here.
    monkeypatch.setattr(map_service, "build_dashboard", lambda farm_id, **kw: _sample(farm_id, now))

    first = asyncio.run(map_service.build_map_overview("live", now=now, pipeline=pipeline))
    assert first.grid_status == "RuntimeError: weather service said no" and not any(l.live for l in first.layers)
    second = asyncio.run(map_service.build_map_overview("live", now=now + timedelta(minutes=5), pipeline=pipeline))
    assert second.grid_status == first.grid_status and len(calls) == 1
    asyncio.run(map_service.build_map_overview("live", now=now + timedelta(minutes=11), pipeline=pipeline))
    assert len(calls) == 2


def _sample(farm_id, now):
    from app.services.dashboard import build_dashboard

    return build_dashboard(farm_id, data_mode="sample", now=now)
