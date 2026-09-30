"""Live risk modules: run the engines on pipeline data and shape the results for the API."""

from dataclasses import dataclass
from datetime import date, timedelta

from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.risk.flood import FloodAssessment, FloodInputs, assess_flood, flood_trend
from app.risk.inputs import flood_inputs
from app.schemas.dashboard import DayForecast, Metric, Recommendation, RiskFactor, RiskModuleSummary

SOURCE_NAMES = {
    "gpm_imerg": "GPM",
    "nasa_power": "NASA POWER",
    "open_meteo": "Forecast",
    "smap": "SMAP",
    "srtm": "SRTM",
    "nasa_power_climatology": "NASA POWER",
}


@dataclass
class LiveFlood:
    assessment: FloodAssessment
    inputs: FloodInputs
    trend: list[int]


def live_flood(pipeline: PipelineService, location: Location, today: date) -> LiveFlood | None:
    """None when there isn't enough real data to say anything honest (no rain data at all)."""
    inputs = flood_inputs(pipeline, location, today)
    has_recent_rain_data = any(today - timedelta(days=3) <= r.date <= today + timedelta(days=3) for r in inputs.rain)
    if not has_recent_rain_data:
        return None
    return LiveFlood(assess_flood(inputs, today), inputs, flood_trend(inputs, today))


def _names(sources: str) -> list[str]:
    return sorted({SOURCE_NAMES.get(s, s) for s in sources.split(" + ") if s and s != "none"})


def flood_module(live: LiveFlood) -> RiskModuleSummary:
    a, inputs = live.assessment, live.inputs
    sources = sorted({name for f in a.factors for name in _names(f.source)})
    rain_source = next((f.source for f in a.factors if f.id == "rain"), "")
    metrics = [Metric(label="Rain, 3 days back + 3 ahead", value=round(a.rain_past3_mm + a.rain_next3_mm), unit="mm", source=", ".join(_names(rain_source)))]
    if inputs.saturation is not None:
        metrics.append(Metric(label="Soil saturation", value=round(inputs.saturation * 100), unit="%", source=SOURCE_NAMES.get(inputs.saturation_source or "", "")))
    elif inputs.elevation_m is not None:
        metrics.append(Metric(label="Field height", value=round(inputs.elevation_m), unit="m", source="SRTM"))

    return RiskModuleSummary(
        id="flood_risk",
        title="Flood risk",
        score=a.score,
        level=a.level,
        headline=a.headline,
        explanation=a.explanation,
        metrics=metrics,
        trend=live.trend,
        change_7d=live.trend[-1] - live.trend[-8],
        sources=sources,
        data_source="live",
        confidence=a.confidence,
        factors=[RiskFactor(id=f.id, label=f.label, score=f.score, weight=f.weight, detail=f.detail, source=", ".join(_names(f.source))) for f in a.factors],
    )


def flood_recommendations(live: LiveFlood) -> list[Recommendation]:
    return [
        Recommendation(id=f"flood-{i + 1}", module="flood_risk", priority=priority, title=title, reason=reason, due=due)
        for i, (priority, title, reason, due) in enumerate(live.assessment.advice)
    ]


# WMO weather codes → the dashboard's five friendly conditions.
def wmo_condition(code: int, rain_mm: float) -> str:
    if code >= 95:
        return "storm"
    if code >= 51 or rain_mm >= 5:
        return "rain"
    if code >= 3:
        return "cloudy"
    if code >= 1:
        return "partly_cloudy"
    return "sunny"


def live_forecast(pipeline: PipelineService, location: Location, today: date) -> list[DayForecast] | None:
    series = {s.id: {p.date: p.value for p in s.points} for s in pipeline.observations(location, days=7)}
    rain = series.get("precipitation_forecast", {})
    days = [today + timedelta(days=i) for i in range(7)]
    if not all(d in rain for d in days):
        return None
    hi, lo, code = series.get("temperature_max_forecast", {}), series.get("temperature_min_forecast", {}), series.get("weather_code", {})
    return [
        DayForecast(
            date=d,
            condition=wmo_condition(int(code.get(d, 0)), rain[d]),
            rain_mm=round(rain[d], 1),
            temp_max_c=round(hi.get(d, 0.0), 1),
            temp_min_c=round(lo.get(d, 0.0), 1),
        )
        for d in days
    ]
