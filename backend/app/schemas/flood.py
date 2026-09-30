from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.dashboard import Recommendation, RiskFactor, RiskLevel


class RainDay(BaseModel):
    date: date
    mm: float
    source: str
    forecast: bool


class FloodInputsOut(BaseModel):
    saturation: float | None
    saturation_source: str | None
    saturation_date: date | None
    normal_mm_per_day: float | None
    elevation_m: float | None


class FloodReport(BaseModel):
    """Everything behind a farm's live flood score, for transparency."""

    farm_id: str
    generated_at: datetime
    score: int
    level: RiskLevel
    headline: str
    explanation: str
    confidence: Literal["high", "medium", "low"]
    factors: list[RiskFactor]
    rain_past3_mm: float
    rain_next3_mm: float
    rain: list[RainDay]
    trend: list[int]
    inputs: FloodInputsOut
    advice: list[Recommendation]
