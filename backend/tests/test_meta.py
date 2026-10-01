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


def test_cors_allows_listed_origins_and_the_optional_pattern(monkeypatch):
    from app.core.config import get_settings
    from app.main import create_app

    monkeypatch.setenv("CORS_ORIGINS", "https://farmshield.vercel.app")
    monkeypatch.setenv("CORS_ORIGIN_REGEX", r"https://farmshield-[a-z0-9-]+\.vercel\.app")
    get_settings.cache_clear()
    try:
        client = TestClient(create_app())

        def allowed(origin):
            res = client.options("/api/v1/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
            return res.headers.get("access-control-allow-origin") == origin

        assert allowed("https://farmshield.vercel.app")
        assert allowed("https://farmshield-git-main-aqshanto.vercel.app")
        assert not allowed("https://evil.example.com")
    finally:
        monkeypatch.delenv("CORS_ORIGINS")
        monkeypatch.delenv("CORS_ORIGIN_REGEX")
        get_settings.cache_clear()
