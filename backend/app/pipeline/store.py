"""SQLite storage for observations and the fetch log.

One small file, no server. Observations are keyed by (source, variable, location, date) so
re-fetching the same day simply updates it (providers revise recent data).
"""

import json
import sqlite3
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

from app.pipeline.models import Observation

SCHEMA = """
CREATE TABLE IF NOT EXISTS observations (
    source     TEXT NOT NULL,
    variable   TEXT NOT NULL,
    location   TEXT NOT NULL,
    date       TEXT NOT NULL,
    value      REAL NOT NULL,
    unit       TEXT NOT NULL,
    quality    TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (source, variable, location, date)
);
CREATE INDEX IF NOT EXISTS observations_by_location ON observations (location, variable, date);

CREATE TABLE IF NOT EXISTS fetch_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT NOT NULL,
    location     TEXT NOT NULL,
    started_at   TEXT NOT NULL,
    finished_at  TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end   TEXT NOT NULL,
    status       TEXT NOT NULL,   -- ok · needs_token · error · skipped
    message      TEXT,
    count        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS fetch_log_by_source ON fetch_log (source, location, finished_at);

CREATE TABLE IF NOT EXISTS cache (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


@dataclass(frozen=True)
class StoredObservation:
    source: str
    variable: str
    date: date
    value: float
    unit: str
    quality: str


@dataclass(frozen=True)
class FetchRecord:
    source: str
    location: str
    finished_at: datetime
    status: str
    message: str | None
    count: int


class ObservationStore:
    def __init__(self, path: str | Path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        # A shared in-memory DB needs one persistent connection; files open per call.
        self._memory = sqlite3.connect(":memory:", check_same_thread=False) if self.path == ":memory:" else None
        with self._connect() as db:
            db.executescript(SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        db = self._memory or sqlite3.connect(self.path, timeout=10)
        try:
            yield db
            db.commit()
        finally:
            if db is not self._memory:
                db.close()

    # --- observations -----------------------------------------------------------------
    def upsert(self, location: str, observations: Iterable[Observation], fetched_at: datetime | None = None) -> int:
        stamp = (fetched_at or datetime.now(UTC)).isoformat()
        rows = [(o.source, o.variable, location, o.date.isoformat(), o.value, o.unit, o.quality, stamp) for o in observations]
        with self._connect() as db:
            db.executemany(
                """INSERT INTO observations (source, variable, location, date, value, unit, quality, fetched_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (source, variable, location, date) DO UPDATE SET
                     value = excluded.value, unit = excluded.unit, quality = excluded.quality, fetched_at = excluded.fetched_at""",
                rows,
            )
        return len(rows)

    def series(self, location: str, variable: str, start: date, end: date, include_rejected: bool = False) -> list[StoredObservation]:
        query = """SELECT source, variable, date, value, unit, quality FROM observations
                   WHERE location = ? AND variable = ? AND date BETWEEN ? AND ?"""
        if not include_rejected:
            query += " AND quality != 'rejected'"
        with self._connect() as db:
            rows = db.execute(query + " ORDER BY date", (location, variable, start.isoformat(), end.isoformat())).fetchall()
        return [StoredObservation(r[0], r[1], date.fromisoformat(r[2]), r[3], r[4], r[5]) for r in rows]

    def latest_date(self, source: str, location: str) -> date | None:
        with self._connect() as db:
            row = db.execute("SELECT MAX(date) FROM observations WHERE source = ? AND location = ?", (source, location)).fetchone()
        return date.fromisoformat(row[0]) if row and row[0] else None

    def counts(self) -> dict[str, int]:
        with self._connect() as db:
            return dict(db.execute("SELECT source, COUNT(*) FROM observations GROUP BY source").fetchall())

    def rejected_counts(self) -> dict[str, int]:
        """Observations that failed quality checks (e.g. cloudy satellite views), per source."""
        with self._connect() as db:
            rows = db.execute("SELECT source, COUNT(*) FROM observations WHERE quality = 'rejected' GROUP BY source").fetchall()
        return dict(rows)

    # --- fetch log --------------------------------------------------------------------
    def log_fetch(
        self,
        source: str,
        location: str,
        started_at: datetime,
        finished_at: datetime,
        window: tuple[date, date],
        status: str,
        message: str | None = None,
        count: int = 0,
    ) -> None:
        with self._connect() as db:
            db.execute(
                """INSERT INTO fetch_log (source, location, started_at, finished_at, window_start, window_end, status, message, count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (source, location, started_at.isoformat(), finished_at.isoformat(), window[0].isoformat(), window[1].isoformat(), status, message, count),
            )

    def last_fetch(self, source: str, location: str | None = None, status: str | None = None) -> FetchRecord | None:
        query = "SELECT source, location, finished_at, status, message, count FROM fetch_log WHERE source = ?"
        params: list = [source]
        if location is not None:
            query += " AND location = ?"
            params.append(location)
        if status is not None:
            query += " AND status = ?"
            params.append(status)
        with self._connect() as db:
            row = db.execute(query + " ORDER BY id DESC LIMIT 1", params).fetchone()
        if not row:
            return None
        return FetchRecord(row[0], row[1], datetime.fromisoformat(row[2]), row[3], row[4], row[5])

    # --- small JSON cache (e.g. mission freshness) --------------------------------------
    def cache_get(self, key: str) -> tuple[object, datetime] | None:
        with self._connect() as db:
            row = db.execute("SELECT value, updated_at FROM cache WHERE key = ?", (key,)).fetchone()
        return (json.loads(row[0]), datetime.fromisoformat(row[1])) if row else None

    def cache_set(self, key: str, value: object, now: datetime | None = None) -> None:
        with self._connect() as db:
            db.execute(
                "INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                (key, json.dumps(value, default=str), (now or datetime.now(UTC)).isoformat()),
            )
