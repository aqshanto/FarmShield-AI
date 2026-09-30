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
    dash = build_map_overview("sample")
    haor = _nearest(dash.cells, 24.95, 91.2)
    barind = _nearest(dash.cells, 24.65, 88.5)
    centre = _nearest(dash.cells, 23.8, 90.4)  # Dhaka: none of the hotspots
    assert haor.flood_risk > centre.flood_risk + 20
    assert barind.water_stress > centre.water_stress + 20
    assert haor.water_stress < barind.water_stress


def test_map_agrees_with_farm_dashboards_near_each_farm():
    overview = build_map_overview("sample")
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
