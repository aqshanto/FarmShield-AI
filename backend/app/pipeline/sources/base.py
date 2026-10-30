from dataclasses import dataclass
from datetime import date
from typing import Protocol

import httpx2

from app.pipeline.models import Location, Observation, VariableId


class SourceError(Exception):
    """A source failed in a way worth reporting (network, auth, bad payload)."""


class RateLimitedError(SourceError):
    """The service refused because too many requests came from this server (HTTP 429)."""


class TokenRequiredError(SourceError):
    """The source needs an Earthdata token that isn't configured (or was rejected)."""


class ApprovalRequiredError(SourceError):
    """The token works, but the data archive needs its terms accepted once in Earthdata Login."""

    def __init__(self, message: str, approve_url: str | None = None):
        super().__init__(message)
        self.approve_url = approve_url


@dataclass(frozen=True)
class SourceInfo:
    id: str
    mission: str  # SMAP · GPM · MODIS · VIIRS · POWER
    provider: str  # who serves it
    product: str  # dataset / collection name
    variables: tuple[VariableId, ...]
    requires_token: bool
    # How long fetched data stays fresh before a refresh re-downloads it.
    ttl_hours: float
    # Re-download this many most recent days on refresh (providers revise recent data).
    overlap_days: int
    note: str = ""
    # Always fetch at least this far back (slow-changing or cloud-prone data).
    min_window_days: int = 0
    # Fetch long windows (an empty database) in pieces this many days long, each saved as it
    # arrives, so a slow server keeps what it got. None: one request covers the whole window.
    chunk_days: int | None = None
    # Takes minutes on an empty database (hundreds of requests). A refresh queues these after
    # the quick sources, so weather, terrain and climate normals are ready first.
    slow: bool = False
    # Seconds one fetch (or one piece of it) may take; None: the pipeline's usual limit.
    timeout_s: float | None = None


class Source(Protocol):
    info: SourceInfo

    async def fetch(self, client: httpx2.AsyncClient, location: Location, start: date, end: date) -> list[Observation]: ...
