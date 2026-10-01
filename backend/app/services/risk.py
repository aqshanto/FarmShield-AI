"""Shared risk vocabulary. Keep thresholds in sync with frontend/src/lib/risk.ts."""

from app.schemas.dashboard import RiskLevel

MODULE_NAMES = {
    "flood_risk": "flood risk",
    "water_stress": "water stress",
    "crop_health": "crop health",
}


def clamp_score(score: float) -> int:
    return round(min(100.0, max(0.0, score)))


def score_to_level(score: float) -> RiskLevel:
    s = clamp_score(score)
    if s < 25:
        return "safe"
    if s < 50:
        return "watch"
    if s < 75:
        return "warning"
    return "danger"


# Highest overall score each worst-module level may reach: compounding lifts a real risk
# by at most one level, and safe modules can't add up to a warning.
OVERALL_CEILING: dict[RiskLevel, int] = {"safe": 24, "watch": 74, "warning": 100, "danger": 100}


def overall_score(scores: list[int]) -> int:
    """Worst module score, nudged up by the others.

    Never lower than the worst risk, so the overall message can't be calmer than the most
    urgent module (a flooding field is a bad week no matter how green the crop is). Other
    real risks (watch or worse) add a quarter of their average, so several medium risks
    outrank a single one; safe modules add nothing, so one "watch" next to two "safe" stays
    a watch and three "safe" signals stay safe.
    """
    if not scores:
        return 0
    ordered = sorted(scores, reverse=True)
    others = [s for s in ordered[1:] if score_to_level(s) != "safe"]
    bump = 0.25 * (sum(others) / len(others)) if others else 0.0
    ceiling = OVERALL_CEILING[score_to_level(ordered[0])]
    return clamp_score(min(ordered[0] + bump, max(ceiling, ordered[0])))


def overall_summary(level: RiskLevel, worst_module: str) -> str:
    name = MODULE_NAMES.get(worst_module, worst_module)
    return {
        "safe": "Your farm is in good shape this week.",
        "watch": f"Mostly fine. Keep an eye on {name}.",
        "warning": f"Prepare now: {name} is rising.",
        "danger": f"Act today: {name} is high.",
    }[level]
