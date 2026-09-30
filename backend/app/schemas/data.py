from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

SourceState = Literal["ok", "pending", "needs_token", "error"]


class SourceStatus(BaseModel):
    id: str
    mission: str
    provider: str
    product: str
    variables: list[str]
    requires_token: bool
    note: str
    state: SourceState
    message: str | None
    last_success: datetime | None
    observations: int


class MissionFreshness(BaseModel):
    mission: str
    product: str
    latest_granule: datetime | None
    granule_id: str | None
    error: str | None


class DataStatus(BaseModel):
    token_configured: bool
    refreshing: bool
    sources: list[SourceStatus]
    missions: list[MissionFreshness]


class ObservationPoint(BaseModel):
    date: date
    value: float
    source: str
    quality: Literal["good", "marginal"]


class VariableSeries(BaseModel):
    id: str
    label: str
    unit: str
    description: str
    sources_used: list[str]
    points: list[ObservationPoint]
    latest: ObservationPoint | None


class FarmObservations(BaseModel):
    farm_id: str
    generated_at: datetime
    days: int
    variables: list[VariableSeries]


class RefreshStarted(BaseModel):
    started: bool
    message: str
