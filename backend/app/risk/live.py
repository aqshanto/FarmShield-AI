"""Live risk modules: run the engines on pipeline data and shape the results for the API."""

from dataclasses import dataclass
from datetime import date, timedelta

from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.risk.flood import FloodAssessment, FloodInputs, assess_flood, flood_trend
from app.risk.crop import CropAssessment, CropInputs, assess_crop, crop_trend
from app.risk.inputs import crop_inputs, flood_inputs, water_inputs
from app.risk.water import WaterAssessment, WaterInputs, assess_water, water_trend
from app.schemas.dashboard import CropIndicators, DayForecast, Metric, Recommendation, RiskAction, RiskFactor, RiskModuleSummary

SOURCE_NAMES = {
    "gpm_imerg": "GPM",
    "nasa_power": "NASA POWER",
    "open_meteo": "Forecast",
    "smap": "SMAP",
    "srtm": "SRTM",
    "nasa_power_climatology": "NASA POWER",
    "modis": "MODIS",
    "viirs": "VIIRS",
    "water engine": "Water stress",
    "flood engine": "Flood risk",
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
    return sorted({SOURCE_NAMES.get(s.strip(), s.strip()) for s in sources.split("+") if s.strip() and s.strip() != "none"})


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


@dataclass
class LiveWater:
    assessment: WaterAssessment
    inputs: WaterInputs
    trend: list[int]


def live_water(pipeline: PipelineService, location: Location, today: date) -> LiveWater | None:
    """None without the core inputs (some soil reading and recent rain)."""
    inputs = water_inputs(pipeline, location, today)
    if not inputs.surface and not inputs.root:
        return None
    if not any(today - timedelta(days=3) <= r.date <= today + timedelta(days=3) for r in inputs.rain):
        return None
    return LiveWater(assess_water(inputs, today), inputs, water_trend(inputs, today))


def water_module(live: LiveWater) -> RiskModuleSummary:
    a = live.assessment
    metrics = []
    if a.topsoil is not None:
        metrics.append(Metric(label="Topsoil wetness", value=round(a.topsoil.value * 100), unit="%", source=SOURCE_NAMES.get(a.topsoil.source, a.topsoil.source)))
    if a.days_since_good_rain is not None:
        metrics.append(Metric(label="Days since good rain", value=a.days_since_good_rain, unit="days", source=", ".join(_names(" + ".join(a.rain_sources)))))
    return RiskModuleSummary(
        id="water_stress",
        title="Water stress",
        score=a.score,
        level=a.level,
        headline=a.headline,
        explanation=a.explanation,
        metrics=metrics,
        trend=live.trend,
        change_7d=live.trend[-1] - live.trend[-8],
        sources=sorted({name for f in a.factors for name in _names(f.source)}),
        data_source="live",
        confidence=a.confidence,
        factors=[RiskFactor(id=f.id, label=f.label, score=f.score, weight=f.weight, detail=f.detail, source=", ".join(_names(f.source))) for f in a.factors],
        status=a.status,
        action=RiskAction(kind=a.action.kind, title=a.action.title, detail=a.action.detail),
    )


def water_recommendations(live: LiveWater) -> list[Recommendation]:
    return [
        Recommendation(id=f"water-{i + 1}", module="water_stress", priority=priority, title=title, reason=reason, due=due)
        for i, (priority, title, reason, due) in enumerate(live.assessment.advice)
    ]


@dataclass
class LiveCrop:
    assessment: CropAssessment
    inputs: CropInputs
    trend: list[int]


def live_crop(
    pipeline: PipelineService, location: Location, today: date, crop: str, water: "LiveWater | None" = None, flood: LiveFlood | None = None
) -> LiveCrop | None:
    """None without any weather around today (can't say anything honest)."""
    inputs = crop_inputs(
        pipeline,
        location,
        today,
        crop,
        water_score=water.assessment.score if water else None,
        water_sources=" + ".join(sorted({f.source for f in water.assessment.factors if f.id == "surface"})) if water else "",
        flood_score=flood.assessment.score if flood else None,
        flood_sources="flood engine",
    )
    if not any(today - timedelta(days=3) <= d <= today + timedelta(days=3) for d in inputs.tmax):
        return None
    trend = crop_trend(inputs, today, water.trend if water else None, flood.trend if flood else None)
    return LiveCrop(assess_crop(inputs, today), inputs, trend)


def crop_module(live: LiveCrop) -> RiskModuleSummary:
    a = live.assessment
    metrics = []
    # Only a fresh, vegetated view is shown as a greenness number (never water or a months-old view).
    if any(f.id == "greenness" for f in a.factors) and a.greenness is not None and a.greenness_normal:
        metrics.append(Metric(label="Greenness vs normal", value=round(a.greenness / a.greenness_normal * 100), unit="%", source="MODIS, VIIRS"))
    if a.cloud_gap_days is not None:
        metrics.append(Metric(label="Last clear view", value=a.cloud_gap_days, unit="days ago", source="MODIS"))
    else:
        metrics.append(Metric(label="Disease-weather days", value=a.disease_days, unit="of 8", source="NASA POWER, Forecast"))
    return RiskModuleSummary(
        id="crop_health",
        title="Crop health",
        score=a.score,
        level=a.level,
        headline=a.headline,
        explanation=a.explanation,
        metrics=metrics,
        trend=live.trend,
        change_7d=live.trend[-1] - live.trend[-8],
        sources=sorted({name for f in a.factors for name in _names(f.source) if name not in ("water engine", "flood engine")}),
        data_source="live",
        confidence=a.confidence,
        factors=[RiskFactor(id=f.id, label=f.label, score=f.score, weight=f.weight, detail=f.detail, source=", ".join(_names(f.source))) for f in a.factors],
        status=a.status,
        indicators=CropIndicators(
            crop=a.profile.name,
            greenness=a.greenness,
            greenness_normal=a.greenness_normal,
            last_clear_view=a.last_clear_view,
            cloud_gap_days=a.cloud_gap_days,
            heat_days=a.heat_days,
            heat_limit_c=a.profile.heat_limit_c,
            disease=a.profile.disease,
            disease_days=a.disease_days,
        ),
    )


def crop_recommendations(live: LiveCrop) -> list[Recommendation]:
    return [
        Recommendation(id=f"crop-{i + 1}", module="crop_health", priority=priority, title=title, reason=reason, due=due)
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
