"""Abuse protection for a public, free-hosted API.

Many endpoints make the server download from NASA, OpenStreetMap and weather services (or
call Claude). Without limits one script could exhaust those services' patience with our
server's address (they block it) or run up AI costs. So each visitor address gets a small
per-minute budget, smaller on the expensive endpoints, and every response carries basic
security headers.
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

WINDOW_S = 60
# (path prefix, requests per minute per visitor). First match wins; the last is the default.
LIMITS: list[tuple[str, int]] = [
    ("/api/v1/assistant/chat", 10),  # may call Claude
    ("/api/v1/data/refresh", 3),  # downloads every NASA source
    ("/api/v1/map/point", 20),  # downloads for a new spot
    ("/api/v1/places/search", 20),  # OpenStreetMap search
    ("/api/v1/locate", 30),
    ("/api/v1/farms/my_", 30),  # a farmer's own field: downloads on first view
    ("/api/v1/", 240),  # everything else (pages load several resources at once)
]
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Resource-Policy": "cross-origin",  # the website on another domain reads it
}


def client_address(request: Request) -> str:
    # Behind Render's proxy the visitor is the last address it appended to X-Forwarded-For
    # (earlier entries can be typed in by the visitor, so they're not trusted).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limits: list[tuple[str, int]] | None = None, window_s: float = WINDOW_S):
        super().__init__(app)
        self.limits = limits or LIMITS
        self.window_s = window_s
        self.hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._last_sweep = time.monotonic()

    def _limit(self, path: str) -> tuple[str, int] | None:
        return next(((prefix, n) for prefix, n in self.limits if path.startswith(prefix)), None)

    def _sweep(self, now: float) -> None:
        # Forget visitors who have been quiet for a whole window, so memory stays small.
        if now - self._last_sweep < self.window_s:
            return
        self._last_sweep = now
        for key in [k for k, q in self.hits.items() if not q or now - q[-1] > self.window_s]:
            del self.hits[key]

    async def dispatch(self, request: Request, call_next) -> Response:
        rule = self._limit(request.url.path) if request.method != "OPTIONS" else None
        if rule is not None:
            now = time.monotonic()
            self._sweep(now)
            prefix, allowed = rule
            hits = self.hits[(client_address(request), prefix)]
            while hits and now - hits[0] > self.window_s:
                hits.popleft()
            if len(hits) >= allowed:
                retry = max(1, int(self.window_s - (now - hits[0])) + 1)
                return JSONResponse(
                    {"detail": "Too many requests from your connection. Please wait a minute and try again."},
                    status_code=429,
                    headers={"Retry-After": str(retry)},
                )
            hits.append(now)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for key, value in SECURITY_HEADERS.items():
            response.headers.setdefault(key, value)
        return response
