"""Turns stored pipeline observations into engine inputs for one farm."""

from datetime import date, timedelta

from app.pipeline.models import Location
from app.pipeline.service import PipelineService, VariableSeries
from app.risk.flood import DailyRain, FloodInputs

# Typical porosity of Bangladeshi alluvial soils (m³/m³): SMAP volumetric moisture divided
# by this gives an approximate 0–1 saturation, comparable with NASA POWER's wetness index.
POROSITY = 0.50
SMAP_MAX_AGE_DAYS = 5  # SMAP revisits every 2–3 days


def _series(observations: list[VariableSeries], variable: str) -> VariableSeries | None:
    return next((s for s in observations if s.id == variable), None)


def flood_inputs(pipeline: PipelineService, location: Location, today: date) -> FloodInputs:
    obs = pipeline.observations(location, days=30)

    # Rainfall per day: observed (GPM, else POWER) wins; the forecast fills recent gaps and the future.
    rain: dict[date, DailyRain] = {}
    forecast = _series(obs, "precipitation_forecast")
    for p in forecast.points if forecast else []:
        rain[p.date] = DailyRain(p.date, p.value, p.source, forecast=p.date > today)
    observed = _series(obs, "precipitation")
    for p in observed.points if observed else []:
        rain[p.date] = DailyRain(p.date, p.value, p.source, forecast=False)

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

    normals = _series(obs, "precipitation_normal")
    normal = next((p.value for p in normals.points if p.date.month == today.month), None) if normals else None

    elevation = _series(obs, "elevation")
    elevation_m = elevation.points[-1].value if elevation and elevation.points else None

    return FloodInputs(
        rain=[rain[d] for d in sorted(rain)],
        saturation=saturation,
        saturation_source=saturation_source,
        saturation_date=saturation_date,
        normal_mm_per_day=normal,
        elevation_m=elevation_m,
    )
