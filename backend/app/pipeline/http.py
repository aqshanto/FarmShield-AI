"""HTTP helpers shared by all sources: timeouts, retries with backoff, clear errors."""

import asyncio

import httpx2

from app.pipeline.sources.base import SourceError, TokenRequiredError

USER_AGENT = "FarmShieldAI/0.1 (NASA Space Apps; +https://github.com/)"
RETRY_STATUSES = {429, 500, 502, 503, 504}


def make_client(**kwargs) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(
        timeout=httpx2.Timeout(30.0, connect=10.0),
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        limits=httpx2.Limits(max_connections=8),
        **kwargs,
    )


async def get(
    client: httpx2.AsyncClient,
    url: str,
    *,
    params: dict | None = None,
    headers: dict | None = None,
    retries: int = 2,
    backoff: float = 1.0,
) -> httpx2.Response:
    """GET with retries on timeouts and transient server errors."""
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await client.get(url, params=params, headers=headers)
        except (httpx2.TimeoutException, httpx2.TransportError) as error:
            last_error = error
        else:
            if response.status_code in RETRY_STATUSES and attempt < retries:
                last_error = SourceError(f"HTTP {response.status_code} from {response.url.host}")
            elif response.status_code in (401, 403) or "/login" in str(response.url):
                raise TokenRequiredError(f"{response.url.host} requires a valid Earthdata token")
            elif response.status_code >= 400:
                raise SourceError(f"HTTP {response.status_code} from {response.url.host}")
            else:
                return response
        if attempt < retries:
            await asyncio.sleep(backoff * 2**attempt)
    raise SourceError(f"Request failed after {retries + 1} attempts: {last_error}")
