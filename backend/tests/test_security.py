"""Abuse protection: rate limits, security headers, the refresh guard, CORS."""

from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import data as data_endpoint
from app.core.config import Settings, get_settings
from app.core.security import RateLimitMiddleware, client_address
from app.main import create_app
from app.pipeline import get_pipeline


def limited_app(limits) -> TestClient:
    app = FastAPI()

    @app.get("/api/v1/map/point")
    def point():
        return {"ok": True}

    @app.get("/api/v1/health")
    def health():
        return {"ok": True}

    app.add_middleware(RateLimitMiddleware, limits=limits)
    return TestClient(app)


def test_each_visitor_gets_a_budget_per_endpoint_group():
    client = limited_app([("/api/v1/map/point", 3), ("/api/v1/", 100)])
    assert [client.get("/api/v1/map/point").status_code for _ in range(4)] == [200, 200, 200, 429]
    blocked = client.get("/api/v1/map/point")
    assert blocked.json()["detail"].startswith("Too many requests") and int(blocked.headers["retry-after"]) >= 1
    assert client.get("/api/v1/health").status_code == 200  # other endpoints keep their own budget
    # Another visitor (as Render's proxy reports it) is not affected.
    other = client.get("/api/v1/map/point", headers={"X-Forwarded-For": "203.0.113.9"})
    assert other.status_code == 200


def test_a_spoofed_forwarded_address_does_not_reset_the_budget():
    from starlette.requests import Request

    request = Request({"type": "http", "headers": [(b"x-forwarded-for", b"1.2.3.4, 198.51.100.7")], "client": ("10.0.0.1", 1)})
    assert client_address(request) == "198.51.100.7"  # the address Render's proxy appended, not the typed one


def test_responses_carry_security_headers_and_cors_has_no_credentials():
    client = TestClient(create_app())
    response = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers.get("access-control-allow-credentials") is None


def test_rate_limiting_is_on_by_default():
    assert Settings.model_fields["rate_limit_enabled"].default is True  # tests switch it off by env


def test_refresh_is_cooled_down_and_force_needs_the_admin_token(monkeypatch):
    started = []
    monkeypatch.setattr(data_endpoint, "start_background_refresh", lambda pipeline, days, force=False: started.append(force) or True)
    monkeypatch.setattr(data_endpoint, "_last_refresh", None)

    class Clock:
        now = datetime(2026, 11, 1, 6)

    class FakePipeline:
        def now(self):
            return Clock.now

    app = create_app()
    app.dependency_overrides[get_pipeline] = lambda: FakePipeline()
    app.dependency_overrides[get_settings] = lambda: Settings(admin_token="s3cret-admin", rate_limit_enabled=False)
    client = TestClient(app)

    assert client.post("/api/v1/data/refresh?force=true").status_code == 403
    assert client.post("/api/v1/data/refresh?force=true", headers={"X-Admin-Token": "wrong"}).status_code == 403
    assert client.post("/api/v1/data/refresh").json()["started"] is True
    second = client.post("/api/v1/data/refresh").json()
    assert second["started"] is False and "recently" in second["message"]
    Clock.now += timedelta(minutes=31)
    assert client.post("/api/v1/data/refresh").json()["started"] is True
    # Maintainers can always force one.
    assert client.post("/api/v1/data/refresh?force=true", headers={"X-Admin-Token": "s3cret-admin"}).json()["started"] is True
    assert started == [False, False, True]


def test_chat_requests_are_bounded():
    client = TestClient(create_app())
    long = {"farm_id": "barind-wheat", "messages": [{"role": "user", "content": "x" * 2001}]}
    many = {"farm_id": "barind-wheat", "messages": [{"role": "user", "content": "hi"}] * 31}
    assert client.post("/api/v1/assistant/chat", json=long).status_code == 422
    assert client.post("/api/v1/assistant/chat", json=many).status_code == 422


def test_a_429_still_carries_cors_headers_so_the_website_can_show_it(monkeypatch):
    from app.core import security

    monkeypatch.setattr(security, "LIMITS", [("/api/v1/", 1)])
    settings = Settings(rate_limit_enabled=True, cors_origins="https://farm-shield-ai-pi.vercel.app")
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    client = TestClient(create_app())
    origin = {"Origin": "https://farm-shield-ai-pi.vercel.app"}
    client.get("/api/v1/health", headers=origin)
    blocked = client.get("/api/v1/health", headers=origin)
    assert blocked.status_code == 429
    assert blocked.headers["access-control-allow-origin"] == "https://farm-shield-ai-pi.vercel.app"
    assert blocked.headers["x-content-type-options"] == "nosniff"
