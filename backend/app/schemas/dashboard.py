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
    area_acres: float | None = None  # unknown for farms a farmer adds
    lat: float
    lon: float
    story: str
    # True for a farm the farmer added (id "my_<lat>_<lon>_<crop>").
    custom: bool = False
    # Set for farms outside Bangladesh (district/division then hold the place and country).
    country: str | None = None


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


class RiskAction(BaseModel):
    """The one thing to do now, e.g. the irrigation decision."""

    kind: Literal["irrigate", "hold", "check", "none"]
    title: str
    detail: str


class CropIndicators(BaseModel):
    """Numbers behind the crop-health visuals."""

    crop: str
    greenness: float | None  # latest clear-sky NDVI
    greenness_normal: float | None  # VIIRS normal at that date
    last_clear_view: date | None
    cloud_gap_days: int | None
    heat_days: int
    heat_limit_c: float
    disease: str
    disease_days: int  # of 8 days around today


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
    # Plain-language state (e.g. "Getting dry") and the recommended action, when the engine has one.
    status: str | None = None
    action: RiskAction | None = None
    indicators: CropIndicators | None = None


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


class SmsPreview(BaseModel):
    """The text message a farmer on a basic phone would get today (see app/services/sms.py)."""

    lang: str
    send: bool  # only a warning or danger sends a message
    text: str = ""
    length: int = 0  # characters, as the phone network counts them
    parts: int = 0  # SMS parts the network would send
    single_limit: int = 0  # characters that fit in one SMS: 160, or 70 for Bengali (Unicode)


class Dashboard(BaseModel):
    farm: Farm
    generated_at: datetime
    last_satellite_pass: datetime
    data_mode: str
    overall: OverallCondition
    modules: list[RiskModuleSummary]
    forecast: list[DayForecast]
    recommendations: list[Recommendation]
    # The day's SMS in English and Bengali, whatever language the page is in.
    sms: list[SmsPreview] = []
