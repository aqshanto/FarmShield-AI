"""HTTP helpers shared by all sources: timeouts, retries with backoff, clear errors."""

import asyncio
import json

import httpx2

from app.pipeline.sources.base import ApprovalRequiredError, RateLimitedError, SourceError, TokenRequiredError

USER_AGENT = "FarmShieldAI/0.1 (NASA Space Apps; +https://github.com/)"
RETRY_STATUSES = {500, 502, 503, 504}

# GES DISC (GPM) serves data only after its application is approved in Earthdata Login.
GES_DISC_APPROVE_URL = "https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ"


def _forbidden_error(response: httpx2.Response) -> SourceError:
    """Explain a 403: usually an archive whose terms (EULA) haven't been accepted yet."""
    body = response.text
    try:
        payload = json.loads(body)
    except ValueError:
        payload = {}
    if isinstance(payload, dict) and "EULA" in str(payload.get("error_description", "")):
        return ApprovalRequiredError("Accept this archive's terms in Earthdata Login", payload.get("resolution_url"))
    # OPeNDAP relays the archive's 403 without the approval link; GES DISC is the known case.
    if "gesdisc" in body.lower() and "403" in body:
        return ApprovalRequiredError("Approve the NASA GESDISC DATA ARCHIVE application in Earthdata Login", GES_DISC_APPROVE_URL)
    return SourceError(f"HTTP 403 (forbidden) from {response.url.host}")


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
    retry_rate_limited: bool = False,
) -> httpx2.Response:
    """GET with retries on timeouts and transient server errors.

    A 429 (rate limited) fails at once, unless `retry_rate_limited` (for per-second limits
    like OpenTopoData's, where waiting a moment helps; daily quotas don't refill in seconds).
    """
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await client.get(url, params=params, headers=headers)
        except (httpx2.TimeoutException, httpx2.TransportError) as error:
            last_error = error
        else:
            if response.status_code == 429 and not (retry_rate_limited and attempt < retries):
                raise RateLimitedError(f"HTTP 429 (rate limited) from {response.url.host}")
            if (response.status_code in RETRY_STATUSES or response.status_code == 429) and attempt < retries:
                last_error = SourceError(f"HTTP {response.status_code} from {response.url.host}")
            elif response.status_code == 403:
                raise _forbidden_error(response)
            elif response.status_code == 401 or "/login" in str(response.url):
                raise TokenRequiredError(f"{response.url.host} requires a valid Earthdata token")
            elif response.status_code >= 400:
                raise SourceError(f"HTTP {response.status_code} from {response.url.host}")
            else:
                return response
        if attempt < retries:
            await asyncio.sleep(backoff * 2**attempt)
    raise SourceError(f"Request failed after {retries + 1} attempts: {last_error}")
