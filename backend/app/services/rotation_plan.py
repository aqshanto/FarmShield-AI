"""Builds a farm's rotation plan from its NASA data (the engine is app/risk/rotation.py)."""

import asyncio

from app.data.sample.farms import SAMPLE_FARMS
from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.risk import rotation as engine
from app.risk.region import in_bangladesh
from app.schemas.rotation import ClimateMonth, RotationCrop, RotationOption, RotationPlan, RotationStrategy
from app.services.custom_farms import CustomFarmError, ensure_data, is_custom_id, parse_farm_id

SOURCES = ["NASA POWER climate normals", "NASA SRTM terrain", "NASA MODIS greenness", "NASA VIIRS normal greenness"]


class RotationFarmError(LookupError):
    pass


class RotationDataPendingError(RuntimeError):
    """The place's climate normals haven't been downloaded yet."""


def _series(pipeline: PipelineService, location: Location) -> dict[str, dict]:
    return {s.id: {p.date: p.value for p in s.points} for s in pipeline.observations(location, days=60)}


def climate_normals(series: dict[str, dict]) -> dict[int, engine.MonthNormal]:
    def by_month(variable: str) -> dict[int, float]:
        return {d.month: v for d, v in series.get(variable, {}).items()}

    rain, high, low = by_month("precipitation_normal"), by_month("temperature_max_normal"), by_month("temperature_min_normal")
    return {m: engine.MonthNormal(rain[m], high[m], low[m]) for m in range(1, 13) if m in rain and m in high and m in low}


def greenness_ratio(series: dict[str, dict]) -> float | None:
    """Latest clear MODIS NDVI ÷ the VIIRS normal for the same time of year."""
    ndvi, normal = series.get("ndvi", {}), series.get("ndvi_normal", {})
    if not ndvi or not normal:
        return None
    day = max(ndvi)
    nearest = min(normal, key=lambda d: abs((d - day).days))
    if abs((nearest - day).days) > 30 or normal[nearest] <= 0.1:
        return None
    return ndvi[day] / normal[nearest]


def pattern_name(pattern_id: str) -> str:
    pattern = engine.PATTERNS_BY_ID[pattern_id]
    slots = engine.calendar_order([engine.Slot(engine.CROPS[c], m) for c, m in pattern.slots], 11)
    return " → ".join(slot.crop.name for slot in slots)


def _strategy(s: engine.Strategy) -> RotationStrategy:
    return RotationStrategy(
        id=s.id,
        name=s.name,
        existing=s.existing,
        verdict=s.verdict,
        overall=s.overall,
        scores=s.scores,
        irrigation_mm=s.irrigation_mm,
        bare_months=s.bare_months,
        crops=[RotationCrop(id=slot.crop.id, name=slot.crop.name, months=list(slot.months)) for slot in s.slots],
        why=s.why,
        evidence=s.evidence,
        benefits=s.benefits,
        gaps=s.gaps,
        risks=s.risks,
    )


async def build_rotation_plan(
    farm_id: str,
    pipeline: PipelineService,
    priorities: set[str],
    irrigation: bool = True,
    existing_id: str | None = None,
) -> RotationPlan:
    if is_custom_id(farm_id):
        try:
            farm = parse_farm_id(farm_id)
        except CustomFarmError as error:
            raise RotationFarmError(str(error)) from None
        location, crop, home = farm.location, farm.crop.name, farm.in_bangladesh
        await ensure_data(pipeline, farm)
    elif farm_id in SAMPLE_FARMS:
        f = SAMPLE_FARMS[farm_id]["farm"]
        location, crop, home = Location(f["id"], f["lat"], f["lon"]), f["crop"], in_bangladesh(f["lat"], f["lon"])
    else:
        raise RotationFarmError(f"Farm '{farm_id}' not found")

    series = _series(pipeline, location)
    if not series.get("temperature_max_normal"):
        # Climate normals cached before the temperatures were added: fetch them once now.
        await pipeline.refresh_location(location, ["power_climatology"], force=True)
        series = _series(pipeline, location)
    climate = climate_normals(series)
    if len(climate) < 12:
        raise RotationDataPendingError(farm_id)

    facts = engine.FieldFacts(
        in_bangladesh=home,
        current_crop=crop,
        climate=climate,
        elevation_m=next(iter(series.get("elevation", {}).values()), None),
        relief_m=next(iter(series.get("height_above_low", {}).values()), None),
        greenness_ratio=greenness_ratio(series),
    )
    result = await asyncio.to_thread(engine.plan, facts, priorities, irrigation, existing_id)
    options = [RotationOption(id=o, name=pattern_name(o)) for o in result.existing_options if o in engine.PATTERNS_BY_ID]
    return RotationPlan(
        farm_id=farm_id,
        crop=crop,
        in_bangladesh=home,
        priorities=sorted(priorities),
        irrigation=irrigation,
        existing_id=result.existing.id,
        existing_options=options or [RotationOption(id=result.existing.id, name=result.existing.name)],
        strategies=[_strategy(s) for s in [result.existing, *result.alternatives]],
        climate=[
            ClimateMonth(month=m, rain_mm=round(c.rain_mm_day * engine.DAYS_PER_MONTH), tmax=c.tmax, tmin=c.tmin)
            for m, c in sorted(climate.items())
        ],
        wet_months=result.wet_months,
        flood_months=result.flood_months,
        field_notes=result.notes,
        sources=SOURCES,
    )
