from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def test_health_reports_ok():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "FarmShield AI"
    assert body["data_mode"] in {"sample", "live"}


def test_sources_lists_all_four_nasa_missions():
    response = client.get("/api/v1/sources")
    assert response.status_code == 200
    ids = {source["id"] for source in response.json()}
    assert ids == {"smap", "gpm", "modis", "viirs"}


def test_default_region_is_bangladesh():
    response = client.get("/api/v1/region/default")
    assert response.status_code == 200
    region = response.json()
    assert region["name"] == "Bangladesh"
    assert 20 < region["lat"] < 27 and 88 < region["lon"] < 93


def test_cors_allows_frontend_dev_origin():
    response = client.options(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
