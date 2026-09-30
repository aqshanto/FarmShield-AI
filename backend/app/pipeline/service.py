"""Runs the pipeline: fetch → clean → store → serve.

- Every (source, location) pair runs concurrently and fails independently.
- Fresh data (younger than the source's TTL) isn't re-downloaded.
- Refreshes are incremental: only days after what we already have, plus a small overlap
  because providers revise recent days.
- Serving merges each variable from its preferred sources, keeping provenance per point.
"""

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

import httpx2

from app.pipeline import catalog
from app.pipeline.http import make_client
from app.pipeline.models import VARIABLES, Location, VariableId
from app.pipeline.sources.base import Source, TokenRequiredError
from app.pipeline.store import ObservationStore

log = logging.getLogger("farmshield.pipeline")

FETCH_TIMEOUT_S = 180
FRESHNESS_TTL = timedelta(hours=1)


@dataclass(frozen=True)
class RefreshResult:
    source: str
    location: str
    status: str  # ok · skipped · needs_token · error
    count: int = 0
    message: str | None = None


@dataclass(frozen=True)
class SeriesPoint:
    date: date
    value: float
    source: str
    quality: str


@dataclass
class VariableSeries:
    id: VariableId
    label: str
    unit: str
    description: str
    points: list[SeriesPoint] = field(default_factory=list)

    @property
    def sources_used(self) -> list[str]:
        return sorted({p.source for p in self.points})


class PipelineService:
    def __init__(
        self,
        store: ObservationStore,
        sources: list[Source],
        client_factory: Callable[[], httpx2.AsyncClient] = make_client,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ):
        self.store = store
        self.sources = {s.info.id: s for s in sources}
        self.client_factory = client_factory
        self.now = now
        self._lock = asyncio.Lock()

    @property
    def refreshing(self) -> bool:
        return self._lock.locked()

    # --- fetch & store ------------------------------------------------------------------
    async def refresh(self, locations: list[Location], days: int = 60, force: bool = False) -> list[RefreshResult]:
        async with self._lock, self.client_factory() as client:
            jobs = [self._refresh_one(client, source, loc, days, force) for source in self.sources.values() for loc in locations]
            results = await asyncio.gather(*jobs)
        summary = {r.status: 0 for r in results}
        for r in results:
            summary[r.status] += 1
        log.info("Pipeline refresh finished: %s", summary)
        return results

    async def _refresh_one(self, client: httpx2.AsyncClient, source: Source, location: Location, days: int, force: bool) -> RefreshResult:
        info = source.info
        started = self.now()
        end = started.date()
        start = end - timedelta(days=max(days, info.min_window_days))

        last_ok = self.store.last_fetch(info.id, location.id, status="ok")
        if not force and last_ok and started - last_ok.finished_at < timedelta(hours=info.ttl_hours):
            return RefreshResult(info.id, location.id, "skipped", message="fresh")

        latest = self.store.latest_date(info.id, location.id)
        if latest and not force:
            start = max(start, latest - timedelta(days=info.overlap_days))

        try:
            observations = await asyncio.wait_for(source.fetch(client, location, start, end), FETCH_TIMEOUT_S)
        except TokenRequiredError as error:
            result = RefreshResult(info.id, location.id, "needs_token", message=str(error))
        except Exception as error:  # isolate: one broken source never stops the others
            log.warning("Source %s failed for %s: %s", info.id, location.id, error)
            result = RefreshResult(info.id, location.id, "error", message=str(error) or type(error).__name__)
        else:
            count = self.store.upsert(location.id, observations, fetched_at=self.now())
            result = RefreshResult(info.id, location.id, "ok", count)

        self.store.log_fetch(info.id, location.id, started, self.now(), (start, end), result.status, result.message, result.count)
        return result

    # --- serve --------------------------------------------------------------------------
    def observations(self, location: Location, days: int = 60) -> list[VariableSeries]:
        end = self.now().date()
        output = []
        for variable in VARIABLES.values():
            start = end - timedelta(days=max(days, variable.lookback_days))
            chosen: dict[date, SeriesPoint] = {}
            # Walk sources from least to most preferred so better sources overwrite.
            for source_id in reversed(variable.sources):
                for row in self.store.series(location.id, variable.id, start, end):
                    if row.source == source_id:
                        chosen[row.date] = SeriesPoint(row.date, row.value, row.source, row.quality)
            output.append(
                VariableSeries(variable.id, variable.label, variable.unit, variable.description, [chosen[d] for d in sorted(chosen)])
            )
        return output

    def source_status(self) -> list[dict]:
        counts = self.store.counts()
        statuses = []
        for source in self.sources.values():
            info = source.info
            last = self.store.last_fetch(info.id)
            last_ok = self.store.last_fetch(info.id, status="ok")
            if info.requires_token and getattr(source, "token", None) is None:
                state = "needs_token"
            elif last is None:
                state = "pending"
            else:
                state = last.status if last.status != "skipped" else "ok"
            statuses.append(
                {
                    "id": info.id,
                    "mission": info.mission,
                    "provider": info.provider,
                    "product": info.product,
                    "variables": list(info.variables),
                    "requires_token": info.requires_token,
                    "note": info.note,
                    "state": state,
                    "message": last.message if last and last.status in ("error", "needs_token") else None,
                    "last_success": last_ok.finished_at if last_ok else None,
                    "observations": counts.get(info.id, 0),
                }
            )
        return statuses

    async def mission_freshness(self, force: bool = False) -> list[dict]:
        cached = self.store.cache_get("mission_freshness")
        if cached and not force and self.now() - cached[1] < FRESHNESS_TTL:
            return cached[0]  # type: ignore[return-value]
        async with self.client_factory() as client:
            fresh = await catalog.mission_freshness(client)
        value = [
            {"mission": f.mission, "product": f.product, "latest_granule": f.latest_granule, "granule_id": f.granule_id, "error": f.error}
            for f in fresh
        ]
        if any(f.latest_granule for f in fresh):
            self.store.cache_set("mission_freshness", value, self.now())
        return value
