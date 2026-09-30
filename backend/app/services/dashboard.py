"""Builds the farmer dashboard.

Today this reads the bundled sample farms. When the NASA pipeline (Phase 4) and risk
engines (Phase 5) land, they replace the sample lookup; the output shape stays the same.
"""

from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING

from app.data.sample.farms import SAMPLE_FARMS
from app.schemas.dashboard import (
    Dashboard,
    DayForecast,
    Farm,
    FarmSummary,
    Metric,
    OverallCondition,
    Recommendation,
    RiskModuleSummary,
)
from app.services.risk import overall_score, overall_summary, score_to_level

if TYPE_CHECKING:
    from app.pipeline.service import PipelineService

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


class FarmNotFoundError(LookupError):
    pass


def list_farms() -> list[FarmSummary]:
    return [FarmSummary(**sample["farm"]) for sample in SAMPLE_FARMS.values()]


def build_dashboard(
    farm_id: str, data_mode: str, now: datetime | None = None, pipeline: "PipelineService | None" = None
) -> Dashboard:
    """In live mode, modules with a risk engine (flood so far) are computed from NASA data;
    the rest, and anything without enough data, fall back to the demo scenario."""
    sample = SAMPLE_FARMS.get(farm_id)
    if sample is None:
        raise FarmNotFoundError(farm_id)

    now = now or datetime.now(UTC)
    modules = [_build_module(module_id, raw) for module_id, raw in sample["modules"].items()]
    recommendations = [
        Recommendation(id=r[0], module=r[1], priority=r[2], title=r[3], reason=r[4], due=r[5]) for r in sample["recommendations"]
    ]
    forecast = _build_forecast(sample["forecast"], now.date())

    if data_mode == "live" and pipeline is not None:
        from app.pipeline.models import Location
        from app.risk.live import flood_module, flood_recommendations, live_flood, live_forecast

        farm = sample["farm"]
        location = Location(farm["id"], farm["lat"], farm["lon"])
        today = _local_today(now)
        flood = live_flood(pipeline, location, today)
        if flood is not None:
            modules = [flood_module(flood) if m.id == "flood_risk" else m for m in modules]
            recommendations = [r for r in recommendations if r.module != "flood_risk"] + flood_recommendations(flood)
        forecast = live_forecast(pipeline, location, today) or forecast

    worst = max(modules, key=lambda m: m.score)
    score = overall_score([m.score for m in modules])
    level = score_to_level(score)

    return Dashboard(
        farm=Farm(**sample["farm"]),
        generated_at=now,
        last_satellite_pass=now - timedelta(hours=sample["hours_since_pass"]),
        data_mode=data_mode,
        overall=OverallCondition(score=score, level=level, summary=overall_summary(level, worst.id)),
        modules=modules,
        forecast=forecast,
        recommendations=sorted(recommendations, key=lambda r: PRIORITY_ORDER[r.priority]),
    )


def _local_today(now: datetime) -> date:
    """Farmers live in Bangladesh (UTC+6): 'today' is their calendar day."""
    return (now.astimezone(UTC) + timedelta(hours=6)).date()


def _build_module(module_id: str, raw: dict) -> RiskModuleSummary:
    trend: list[int] = raw["trend"]
    score = trend[-1]
    return RiskModuleSummary(
        id=module_id,
        title=raw["title"],
        score=score,
        level=score_to_level(score),
        headline=raw["headline"],
        explanation=raw["explanation"],
        metrics=[Metric(label=m[0], value=m[1], unit=m[2], source=m[3]) for m in raw["metrics"]],
        trend=trend,
        change_7d=score - trend[-8],
        sources=raw["sources"],
    )


def _build_forecast(days: list[tuple], today: date) -> list[DayForecast]:
    return [
        DayForecast(date=today + timedelta(days=i), condition=c, rain_mm=rain, temp_max_c=tmax, temp_min_c=tmin)
        for i, (c, rain, tmax, tmin) in enumerate(days)
    ]
