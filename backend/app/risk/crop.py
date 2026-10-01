"""Crop health engine: an explainable scorecard, tuned per crop.

Factors, each 0–100 (higher = less healthy), weighted:

  greenness vs normal  30%  latest clear MODIS NDVI vs the VIIRS seasonal normal
  greenness trend      15%  change between the last two clear views
  water stress         20%  the water engine's live score
  heat stress          15%  days above the crop's own heat limit (past week + forecast)
  waterlogging         10%  the flood engine's live score
  disease weather      10%  humid days in the crop's disease temperature band

Monsoon clouds often hide fields from MODIS for weeks. Then the greenness factors drop
out, weights re-normalise, confidence falls, and the explanation says so plainly.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from app.risk.flood import DailyRain, Factor
from app.risk.water import Reading
from app.services.risk import clamp_score, score_to_level

Confidence = Literal["high", "medium", "low"]

WEIGHTS = {"greenness": 0.30, "trend": 0.15, "water": 0.20, "heat": 0.15, "flood": 0.10, "disease": 0.10}
CLEAR_VIEW_MAX_AGE = 45  # days a clear NDVI view still describes the field
HUMID = 90  # % relative humidity that keeps leaves wet enough for fungal spores
# Below this NDVI a pixel is open water or bare soil: no crop is visible, which says
# nothing about crop health (a flooded haor or a fallow field is not a sick crop).
NO_CROP_NDVI = 0.1
SEVERE_GREENNESS = 80  # greenness factor score that means clearly visible decline
SEVERE_FLOOR = 55  # ... which keeps the overall score at "warning" or worse
RAINY_DAY_MM = 5  # stand-in for humidity when it isn't available


@dataclass(frozen=True)
class CropProfile:
    name: str
    heat_limit_c: float  # daily high above which the crop is stressed
    disease: str
    disease_temp_c: tuple[float, float]  # mean temperature band where the disease thrives
    disease_advice: tuple[str, str]  # (title, reason)


PROFILES = {
    "rice": CropProfile(
        "rice", 35, "rice blast", (24, 30),
        ("Check leaves for blast spots", "Warm, very humid days favour rice blast. Look for grey, diamond-shaped spots on leaves."),
    ),
    "wheat": CropProfile(
        "wheat", 32, "wheat blast", (25, 30),
        ("Watch for wheat blast", "Warm, wet weather favours wheat blast. Look for bleached, empty spikes."),
    ),
    "potato": CropProfile(
        "potato", 29, "late blight", (10, 25),
        ("Protect against late blight", "Cool, humid days favour late blight. Spray a protective fungicide before the next rain."),
    ),
    # Added for "Add my farm". Heat limits and disease weather from BAMIS crop-weather
    # calendars and published crop research (sources in docs/DECISIONS.md).
    "maize": CropProfile(
        "maize", 35, "northern leaf blight", (18, 27),
        ("Check leaves for leaf blight", "Mild, wet weather favours northern leaf blight. Look for long grey-green or tan streaks on leaves."),
    ),
    "jute": CropProfile(
        "jute", 37, "stem rot", (25, 30),
        ("Check stems for stem rot", "Cloudy, rainy, humid days favour stem rot. Look for dark brown patches on stems and remove sick plants."),
    ),
    "mustard": CropProfile(
        "mustard", 32, "Alternaria blight", (18, 28),
        ("Watch for Alternaria blight", "Humid weather with heavy dew favours Alternaria blight. Look for dark round spots with rings on leaves and pods."),
    ),
    "lentil": CropProfile(
        "lentil", 30, "Stemphylium blight", (15, 25),
        ("Watch for Stemphylium blight", "Mild, humid weather favours Stemphylium blight. Look for small tan spots that spread and make leaves fall."),
    ),
    "tomato": CropProfile(
        "tomato", 32, "late blight", (10, 25),
        ("Protect against late blight", "Cool, humid days favour late blight. Look for dark, wet-looking patches on leaves and fruit."),
    ),
    "default": CropProfile(
        "crop", 35, "fungal disease", (20, 30),
        ("Check leaves for disease", "Warm, humid days favour fungal disease. Look for spots or mould on leaves."),
    ),
}


def crop_profile(crop: str) -> CropProfile:
    text = crop.lower()
    return next((p for key, p in PROFILES.items() if key != "default" and key in text), PROFILES["default"])


@dataclass(frozen=True)
class CropInputs:
    crop: str
    rain: list[DailyRain]
    tmax: dict[date, Reading]
    tmean: dict[date, float]
    humidity: dict[date, float]
    ndvi: dict[date, Reading] = field(default_factory=dict)  # clear-sky views only
    ndvi_normal: dict[date, float] = field(default_factory=dict)
    water_score: int | None = None
    water_sources: str = ""
    flood_score: int | None = None
    flood_sources: str = ""


@dataclass
class CropAssessment:
    score: int
    level: str
    status: str
    headline: str
    explanation: str
    factors: list[Factor]
    confidence: Confidence
    profile: CropProfile
    last_clear_view: date | None
    greenness: float | None
    greenness_normal: float | None
    cloud_gap_days: int | None
    heat_days: int
    disease_days: int
    advice: list[tuple[str, str, str, str]] = field(default_factory=list)


def _clamp01(x: float) -> float:
    return min(1.0, max(0.0, x))


def _normal_at(inputs: CropInputs, day: date) -> float | None:
    if not inputs.ndvi_normal:
        return None
    return inputs.ndvi_normal[min(inputs.ndvi_normal, key=lambda d: abs((d - day).days))]


def clear_views(inputs: CropInputs, day: date) -> list[tuple[date, Reading]]:
    """Recent clear-sky views that actually show vegetation."""
    return sorted(
        (d, r) for d, r in inputs.ndvi.items() if day - timedelta(days=CLEAR_VIEW_MAX_AGE) <= d <= day and r.value >= NO_CROP_NDVI
    )


def heat_days(inputs: CropInputs, day: date, profile: CropProfile) -> int:
    window = [day + timedelta(days=i) for i in range(-6, 4)]
    return sum(1 for d in window if d in inputs.tmax and inputs.tmax[d].value >= profile.heat_limit_c)


def disease_days(inputs: CropInputs, day: date, profile: CropProfile) -> int:
    """Days in the last 5 + next 3 that suit the crop's main disease."""
    rain = {r.date: r.mm for r in inputs.rain}
    low, high = profile.disease_temp_c
    count = 0
    for d in (day + timedelta(days=i) for i in range(-4, 4)):
        temp = inputs.tmean.get(d)
        if temp is None or not low <= temp <= high:
            continue
        humid = inputs.humidity.get(d)
        if (humid is not None and humid >= HUMID) or (humid is None and rain.get(d, 0) >= RAINY_DAY_MM):
            count += 1
    return count


def score_factors(inputs: CropInputs, day: date) -> tuple[int, list[Factor]]:
    profile = crop_profile(inputs.crop)
    factors: list[Factor] = []

    views = clear_views(inputs, day)
    if views and (normal := _normal_at(inputs, views[-1][0])) is not None:
        view_day, view = views[-1]
        deficit = normal - view.value
        pct = view.value / normal * 100 if normal > 0 else 100
        words = "as green as normal" if abs(deficit) < 0.05 else ("greener than normal" if deficit < 0 else "less green than normal")
        factors.append(
            Factor("greenness", "Less green than normal", round(100 * _clamp01(deficit / 0.25)), WEIGHTS["greenness"], f"Plants were {words} ({pct:.0f}% of normal) on {view_day.strftime('%d %b')}", "modis + viirs")
        )
        if len(views) >= 2:
            (d0, v0), (d1, v1) = views[-2], views[-1]
            per16 = (v0.value - v1.value) / max(1, (d1 - d0).days) * 16  # drop per 16-day composite
            trend_words = "falling" if per16 > 0.03 else "rising" if per16 < -0.03 else "steady"
            factors.append(Factor("trend", "Greenness falling", round(100 * _clamp01(per16 / 0.15)), WEIGHTS["trend"], f"Greenness is {trend_words} between the last two clear views", "modis"))

    if inputs.water_score is not None:
        factors.append(Factor("water", "Thirsty crop", inputs.water_score, WEIGHTS["water"], f"Water stress is {score_to_level(inputs.water_score)} ({inputs.water_score}/100)", inputs.water_sources or "water engine"))

    temps = [d for d in (day + timedelta(days=i) for i in range(-6, 4)) if d in inputs.tmax]
    if len(temps) >= 5:
        hot = heat_days(inputs, day, profile)
        factors.append(
            Factor("heat", "Heat stress", round(100 * _clamp01(hot / 5)), WEIGHTS["heat"], f"{hot} of 10 days (last week and next 3) reach {profile.heat_limit_c:.0f}°C, the limit for {profile.name}", " + ".join(sorted({inputs.tmax[d].source for d in temps})))
        )

    if inputs.flood_score is not None:
        factors.append(Factor("flood", "Waterlogging", round(100 * _clamp01((inputs.flood_score - 25) / 50)), WEIGHTS["flood"], f"Flood risk is {score_to_level(inputs.flood_score)} ({inputs.flood_score}/100)", inputs.flood_sources or "flood engine"))

    if any(d in inputs.tmean for d in (day + timedelta(days=i) for i in range(-4, 4))):
        sick = disease_days(inputs, day, profile)
        factors.append(
            Factor("disease", "Disease weather", round(100 * _clamp01(sick / 5)), WEIGHTS["disease"], f"{sick} of 8 days around today suit {profile.disease}", "nasa_power + open_meteo")
        )

    weight = sum(f.weight for f in factors)
    score = sum(f.score * f.weight for f in factors) / weight if weight else 0
    # Seeing is believing: when a clear satellite view shows severe yellowing, kind weather
    # must not dilute it below "warning".
    if any(f.id == "greenness" and f.score >= SEVERE_GREENNESS for f in factors):
        score = max(score, SEVERE_FLOOR)
    return clamp_score(score), factors


STATUS = {"safe": "Healthy", "watch": "Mostly healthy", "warning": "Under stress", "danger": "At risk"}
HEADLINES = {
    "safe": "Your crop looks healthy.",
    "watch": "Your crop is mostly healthy. A few things to watch.",
    "warning": "Your crop is under stress.",
    "danger": "Your crop is at risk. Act now.",
}


def _advice(factors: list[Factor], profile: CropProfile, cloud_gap: int | None, has_greenness: bool) -> list[tuple[str, str, str, str]]:
    by = {f.id: f for f in factors}
    items: list[tuple[int, tuple[str, str, str, str]]] = []

    def add(factor_id: str, item: tuple[str, str, str, str]) -> None:
        items.append((by[factor_id].score if factor_id in by else 0, item))

    def urgency(score: int) -> str:
        return "high" if score >= 70 else "medium"

    if "greenness" in by and by["greenness"].score >= 40:
        add("greenness", (urgency(by["greenness"].score), "Walk your field and check for yellow or wilting plants", "Satellites see your plants less green than normal for this time of year.", "Within 2 days"))
    if "disease" in by and by["disease"].score >= 40:
        title, reason = profile.disease_advice
        add("disease", (urgency(by["disease"].score), title, reason, "This week"))
    if "heat" in by and by["heat"].score >= 40:
        add("heat", ("medium", "Water in the evening on hot days", f"Days above {profile.heat_limit_c:.0f}°C stress {profile.name}. Evening water cools the field.", "Hot days"))
    if "water" in by and by["water"].score >= 50:
        add("water", (urgency(by["water"].score), "Follow the irrigation advice", "Dry soil is holding your crop back. See Water stress.", "Today"))
    if "flood" in by and by["flood"].score >= 50:
        add("flood", ("high", "Drain standing water", "Roots rot when a field stays waterlogged for days.", "Within 2 days"))

    advice = [item for _, item in sorted(items, key=lambda x: -x[0])][:3]
    if not has_greenness and cloud_gap is not None and cloud_gap > 30:
        advice.append(("low", "Walk the field this week", f"Clouds have hidden your field from satellites for {cloud_gap} days, so your eyes matter most.", "This week"))
    if not advice:
        advice.append(("low", "Keep up regular field checks", "Your crop looks healthy. A weekly walk catches problems early.", "This week"))
    return advice


def assess_crop(inputs: CropInputs, today: date) -> CropAssessment:
    profile = crop_profile(inputs.crop)
    score, factors = score_factors(inputs, today)
    level = score_to_level(score)

    all_views = sorted(inputs.ndvi.items())
    last_view = all_views[-1] if all_views else None
    cloud_gap = (today - last_view[0]).days if last_view else None
    has_greenness = any(f.id == "greenness" for f in factors)

    top = sorted(factors, key=lambda f: f.score * f.weight, reverse=True)[:2]
    if level == "safe":
        # Only claim what satellites actually saw: without a clear view, speak about conditions.
        explanation = (
            "Your plants look as they should for this time of year, and the weather is kind to them."
            if has_greenness
            else "Soil, water and weather are kind to your crop right now."
        )
    else:
        reasons = [f.detail for f in top if f.score >= 25]
        explanation = (". ".join(reasons) + ".") if reasons else "A few conditions are not ideal for your crop."
    if not has_greenness:
        basis = "" if level == "safe" else ", so this check uses soil, water and weather instead"
        if last_view and last_view[1].value < NO_CROP_NDVI:
            explanation += f" The last clear satellite view ({last_view[0].strftime('%d %B')}) showed water or bare soil{basis}."
        else:
            since = f" since {last_view[0].strftime('%d %B')}" if last_view else ""
            explanation += f" Clouds have hidden your field from satellites{since}{basis}."

    ids = {f.id for f in factors}
    if has_greenness and {"water", "heat"} <= ids:
        confidence: Confidence = "high"
    elif len(ids) >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    normal = _normal_at(inputs, last_view[0]) if last_view else None
    return CropAssessment(
        score=score,
        level=level,
        status=STATUS[level],
        headline=HEADLINES[level],
        explanation=explanation,
        factors=factors,
        confidence=confidence,
        profile=profile,
        last_clear_view=last_view[0] if last_view else None,
        greenness=last_view[1].value if last_view else None,
        greenness_normal=normal,
        cloud_gap_days=cloud_gap,
        heat_days=heat_days(inputs, today, profile),
        disease_days=disease_days(inputs, today, profile),
        advice=_advice(factors, profile, cloud_gap, has_greenness),
    )


def crop_trend(inputs: CropInputs, today: date, water_trend: list[int] | None = None, flood_trend: list[int] | None = None, days: int = 14) -> list[int]:
    """Daily scores for the last `days` days, using the water and flood trends for those days."""
    out = []
    for i in range(days):
        day = today - timedelta(days=days - 1 - i)
        day_inputs = CropInputs(
            **{
                **inputs.__dict__,
                "water_score": water_trend[i] if water_trend and len(water_trend) == days else inputs.water_score,
                "flood_score": flood_trend[i] if flood_trend and len(flood_trend) == days else inputs.flood_score,
            }
        )
        out.append(score_factors(day_inputs, day)[0])
    return out
