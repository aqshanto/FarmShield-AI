"""Turns stored pipeline observations into engine inputs for one farm."""

from datetime import date, timedelta

from app.pipeline.models import Location
from app.pipeline.service import PipelineService, VariableSeries
from app.risk.crop import CropInputs
from app.risk.flood import DailyRain, FloodInputs
from app.risk.water import Reading, WaterInputs

# Typical porosity of Bangladeshi alluvial soils (m³/m³): SMAP volumetric moisture divided
# by this gives an approximate 0–1 saturation, comparable with NASA POWER's wetness index.
POROSITY = 0.50
SMAP_MAX_AGE_DAYS = 5  # SMAP revisits every 2–3 days


def _series(observations: list[VariableSeries], variable: str) -> VariableSeries | None:
    return next((s for s in observations if s.id == variable), None)


def merged_rain(obs: list[VariableSeries], today: date) -> list[DailyRain]:
    """Daily rain: observed (GPM, else POWER) wins; the forecast fills recent gaps and the future."""
    rain: dict[date, DailyRain] = {}
    forecast = _series(obs, "precipitation_forecast")
    for p in forecast.points if forecast else []:
        rain[p.date] = DailyRain(p.date, p.value, p.source, forecast=p.date > today)
    observed = _series(obs, "precipitation")
    for p in observed.points if observed else []:
        rain[p.date] = DailyRain(p.date, p.value, p.source, forecast=False)
    return [rain[d] for d in sorted(rain)]


def _monthly_normals(obs: list[VariableSeries]) -> dict[int, float]:
    normals = _series(obs, "precipitation_normal")
    return {p.date.month: p.value for p in normals.points} if normals else {}


def flood_inputs(pipeline: PipelineService, location: Location, today: date) -> FloodInputs:
    obs = pipeline.observations(location, days=30)

    # Soil saturation: SMAP if recent, otherwise NASA POWER surface wetness.
    saturation = saturation_source = saturation_date = None
    smap = _series(obs, "soil_moisture")
    recent_smap = [p for p in smap.points if p.date >= today - timedelta(days=SMAP_MAX_AGE_DAYS)] if smap else []
    if recent_smap:
        p = recent_smap[-1]
        saturation, saturation_source, saturation_date = min(1.0, p.value / POROSITY), "smap", p.date
    else:
        wetness = _series(obs, "soil_wetness")
        if wetness and wetness.points:
            p = wetness.points[-1]
            saturation, saturation_source, saturation_date = p.value, p.source, p.date

    elevation = _series(obs, "elevation")
    return FloodInputs(
        rain=merged_rain(obs, today),
        saturation=saturation,
        saturation_source=saturation_source,
        saturation_date=saturation_date,
        normal_mm_per_day=_monthly_normals(obs).get(today.month),
        elevation_m=elevation.points[-1].value if elevation and elevation.points else None,
    )


def water_inputs(pipeline: PipelineService, location: Location, today: date) -> WaterInputs:
    # 30-day rain sums over a 14-day trend need ~45 days of history.
    obs = pipeline.observations(location, days=50)

    surface: dict[date, Reading] = {}
    wetness = _series(obs, "soil_wetness")
    for p in wetness.points if wetness else []:
        surface[p.date] = Reading(p.value, p.source)
    smap = _series(obs, "soil_moisture")
    for p in smap.points if smap else []:  # SMAP replaces POWER on its days; the engine prefers it while fresh
        surface[p.date] = Reading(min(1.0, p.value / POROSITY), "smap")

    root_series = _series(obs, "root_zone_wetness")
    root = {p.date: Reading(p.value, p.source) for p in root_series.points} if root_series else {}

    tmax: dict[date, Reading] = {}
    forecast_t = _series(obs, "temperature_max_forecast")
    for p in forecast_t.points if forecast_t else []:
        tmax[p.date] = Reading(p.value, p.source)
    observed_t = _series(obs, "temperature_max")
    for p in observed_t.points if observed_t else []:
        tmax[p.date] = Reading(p.value, p.source)

    ndvi_series = _series(obs, "ndvi")
    normal_series = _series(obs, "ndvi_normal")
    return WaterInputs(
        rain=merged_rain(obs, today),
        surface=surface,
        root=root,
        tmax=tmax,
        normals=_monthly_normals(obs),
        ndvi={p.date: Reading(p.value, p.source) for p in ndvi_series.points} if ndvi_series else {},
        ndvi_normal={p.date: p.value for p in normal_series.points} if normal_series else {},
    )


def _merged(obs: list[VariableSeries], forecast_id: str, observed_id: str) -> dict[date, float]:
    """Forecast values, overwritten by observations where they exist."""
    out: dict[date, float] = {}
    for variable in (forecast_id, observed_id):
        series = _series(obs, variable)
        for p in series.points if series else []:
            out[p.date] = p.value
    return out


def crop_inputs(
    pipeline: PipelineService,
    location: Location,
    today: date,
    crop: str,
    water_score: int | None = None,
    water_sources: str = "",
    flood_score: int | None = None,
    flood_sources: str = "",
) -> CropInputs:
    obs = pipeline.observations(location, days=30)

    tmax: dict[date, Reading] = {}
    for variable in ("temperature_max_forecast", "temperature_max"):  # observed wins
        series = _series(obs, variable)
        for p in series.points if series else []:
            tmax[p.date] = Reading(p.value, p.source)

    ndvi = _series(obs, "ndvi")  # served points are clear-sky (good or marginal) only
    normal = _series(obs, "ndvi_normal")
    return CropInputs(
        crop=crop,
        rain=merged_rain(obs, today),
        tmax=tmax,
        tmean=_merged(obs, "temperature_mean_forecast", "temperature_mean"),
        humidity=_merged(obs, "humidity_forecast", "humidity"),
        ndvi={p.date: Reading(p.value, p.source) for p in ndvi.points} if ndvi else {},
        ndvi_normal={p.date: p.value for p in normal.points} if normal else {},
        water_score=water_score,
        water_sources=water_sources,
        flood_score=flood_score,
        flood_sources=flood_sources,
    )
