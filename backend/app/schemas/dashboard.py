from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.meta import RiskModule

RiskLevel = Literal["safe", "watch", "warning", "danger"]
Priority = Literal["high", "medium", "low"]
WeatherCondition = Literal["sunny", "partly_cloudy", "cloudy", "rain", "storm"]


class FarmSummary(BaseModel):
    id: str
    name: str
    district: str
    crop: str


class Farm(FarmSummary):
    division: str
    area_acres: float
    lat: float
    lon: float
    story: str


class Metric(BaseModel):
    label: str
    value: float
    unit: str
    source: str


class RiskFactor(BaseModel):
    """One reason behind a live risk score (0–100 each, weighted)."""

    id: str
    label: str
    score: int
    weight: float
    detail: str
    source: str


class RiskModuleSummary(BaseModel):
    id: RiskModule
    title: str
    # 0-100, higher = more risk (for crop health: higher = less healthy).
    score: int
    level: RiskLevel
    headline: str
    explanation: str
    metrics: list[Metric]
    # Daily risk score for the last 14 days, oldest first; the last value is today.
    trend: list[int]
    # Score change vs 7 days ago (positive = risk rising).
    change_7d: int
    sources: list[str]
    # "live": computed by a risk engine from NASA data · "sample": demo scenario.
    data_source: Literal["live", "sample"] = "sample"
    confidence: Literal["high", "medium", "low"] | None = None
    factors: list[RiskFactor] = []


class OverallCondition(BaseModel):
    score: int
    level: RiskLevel
    summary: str


class DayForecast(BaseModel):
    date: date
    condition: WeatherCondition
    rain_mm: float
    temp_max_c: float
    temp_min_c: float


class Recommendation(BaseModel):
    id: str
    module: RiskModule
    priority: Priority
    title: str
    reason: str
    due: str


class Dashboard(BaseModel):
    farm: Farm
    generated_at: datetime
    last_satellite_pass: datetime
    data_mode: str
    overall: OverallCondition
    modules: list[RiskModuleSummary]
    forecast: list[DayForecast]
    recommendations: list[Recommendation]
