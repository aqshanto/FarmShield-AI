"""Flood risk engine: an explainable scorecard.

Four factors a farmer can understand, each scored 0–100:

  water arriving (40%)  rain in the last 3 days + the next 3 days
  ground is full (25%)  how saturated the soil already is (SMAP, else NASA POWER)
  unusually wet  (15%)  this week's rain against the normal for this month (NASA POWER)
  low-lying land (20%)  height above sea level (NASA SRTM)

Without meaningful rain (past or forecast) a field can't flood from local rain, so the
score is capped at "watch". Missing inputs are dropped and the remaining weights
re-normalised, which lowers the reported confidence instead of guessing.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from app.services.risk import clamp_score, score_to_level

Confidence = Literal["high", "medium", "low"]

WEIGHTS = {"rain": 0.40, "saturation": 0.25, "anomaly": 0.15, "terrain": 0.20}
DRY_CAP = 45  # max score when there's almost no rain around
DRY_RAIN_MM = 20  # "almost no rain" over the 6-day window

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


@dataclass(frozen=True)
class DailyRain:
    date: date
    mm: float
    source: str  # gpm_imerg · nasa_power · open_meteo (forecast)
    forecast: bool


@dataclass(frozen=True)
class FloodInputs:
    rain: list[DailyRain]  # observed + forecast, one entry per day
    saturation: float | None  # 0–1
    saturation_source: str | None
    saturation_date: date | None
    normal_mm_per_day: float | None  # this month's normal
    elevation_m: float | None
    # Outside Bangladesh: height above the lowest land nearby, used instead of height above
    # sea level (a valley floor floods at any altitude; the delta rule only fits deltas).
    relief_m: float | None = None


@dataclass(frozen=True)
class Factor:
    id: str
    label: str
    score: int  # 0–100
    weight: float
    detail: str  # plain-language evidence
    source: str


@dataclass
class FloodAssessment:
    score: int
    level: str
    headline: str
    explanation: str
    factors: list[Factor]
    confidence: Confidence
    rain_past3_mm: float
    rain_next3_mm: float
    wettest_day: DailyRain | None
    advice: list[tuple[str, str, str, str]] = field(default_factory=list)  # (priority, title, reason, due)


def _clamp01(x: float) -> float:
    return min(1.0, max(0.0, x))


def saturation_words(saturation: float) -> str:
    pct = f"The soil is {saturation * 100:.0f}% saturated"
    if saturation >= 0.8:
        return f"{pct}, so new rain runs off instead of soaking in"
    if saturation >= 0.6:
        return f"{pct} and can't hold much more rain"
    return f"{pct} and can still soak up rain"


def relief_words(relief_m: float) -> str:
    height = f"The field sits {relief_m:.0f} m above the lowest land nearby"
    if relief_m <= 4:
        return f"{height}, where water collects first"
    if relief_m >= 20:
        return f"{height}, high enough to drain well"
    return height


def terrain_words(elevation_m: float) -> str:
    height = f"The field sits {elevation_m:.0f} m above sea level"
    if elevation_m <= 12:
        return f"{height}, low land where water collects first"
    if elevation_m >= 30:
        return f"{height}, high enough to drain well"
    return height


def rain_window(rain: list[DailyRain], day: date) -> tuple[float, float]:
    """(rain in the 3 days ending `day`, rain in the 3 days after `day`)."""
    by_day = {r.date: r.mm for r in rain}
    past = sum(by_day.get(day - timedelta(days=i), 0.0) for i in range(3))
    future = sum(by_day.get(day + timedelta(days=i), 0.0) for i in range(1, 4))
    return past, future


def score_factors(inputs: FloodInputs, day: date) -> tuple[int, list[Factor], float, float]:
    past, future = rain_window(inputs.rain, day)
    total = past + future
    factors: list[Factor] = []

    rain_sources = sorted({r.source for r in inputs.rain if day - timedelta(days=2) <= r.date <= day + timedelta(days=3)})
    factors.append(
        Factor(
            "rain",
            "Water arriving",
            round(100 * _clamp01(total / 200)),  # 200 mm over 6 days ≈ extreme
            WEIGHTS["rain"],
            f"{past:.0f} mm fell in the last 3 days and {future:.0f} mm is expected in the next 3",
            " + ".join(rain_sources) or "none",
        )
    )

    if inputs.saturation is not None:
        factors.append(
            Factor(
                "saturation",
                "Ground is full",
                round(100 * _clamp01((inputs.saturation - 0.4) / 0.5)),  # 40% → 0, 90% → 100
                WEIGHTS["saturation"],
                saturation_words(inputs.saturation),
                inputs.saturation_source or "unknown",
            )
        )

    if inputs.normal_mm_per_day:
        by_day = {r.date: r.mm for r in inputs.rain}
        week = sum(by_day.get(day - timedelta(days=i), 0.0) for i in range(7))
        ratio = week / (inputs.normal_mm_per_day * 7)
        factors.append(
            Factor(
                "anomaly",
                "Unusually wet",
                round(100 * _clamp01((ratio - 1) / 2)),  # normal → 0, 3× normal → 100
                WEIGHTS["anomaly"],
                f"This week brought {ratio:.1f}× the normal rain for {MONTH_NAMES[day.month - 1]}",
                "nasa_power_climatology",
            )
        )

    if inputs.relief_m is not None:
        factors.append(
            Factor(
                "terrain",
                "Low-lying land",
                round(100 * _clamp01((25 - inputs.relief_m) / 22)),  # ≤3 m above the low ground → 100, ≥25 m → 0
                WEIGHTS["terrain"],
                relief_words(inputs.relief_m),
                "srtm",
            )
        )
    elif inputs.elevation_m is not None:
        factors.append(
            Factor(
                "terrain",
                "Low-lying land",
                round(100 * _clamp01((40 - inputs.elevation_m) / 32)),  # ≤8 m → 100, ≥40 m → 0
                WEIGHTS["terrain"],
                terrain_words(inputs.elevation_m),
                "srtm",
            )
        )

    weight = sum(f.weight for f in factors)
    score = sum(f.score * f.weight for f in factors) / weight if weight else 0
    if total < DRY_RAIN_MM:
        score = min(score, DRY_CAP)
    return clamp_score(score), factors, past, future


HEADLINES = {
    "safe": "Low flood risk this week.",
    "watch": "Some flood risk. Keep an eye on the weather.",
    "warning": "Flooding is possible in the next few days.",
    "danger": "Flooding is likely. Prepare today.",
}

ADVICE = {
    "safe": [("low", "Keep drainage channels clear", "Clear channels let heavy rain drain away quickly.", "This week")],
    "watch": [
        ("medium", "Check and clear drainage channels", "Water needs a way out if heavy rain comes.", "Within 2 days"),
        ("low", "Watch the forecast each morning", "Rain upstream can raise water levels fast.", "Daily"),
    ],
    "warning": [
        ("high", "Clear drainage channels now", "Open channels let water leave your field faster.", "Today"),
        ("medium", "Move seed, fertilizer and tools to high ground", "Keep your inputs dry and safe.", "Within 2 days"),
        ("medium", "Harvest any crop that is ready", "Grain in store is safe from flood water.", "Within 2 days"),
    ],
    "danger": [
        ("high", "Harvest ripe crops now", "A crop that is 80% ripe is safer in your store than in a flooded field.", "Today"),
        ("high", "Move seed, fertilizer and animals to high ground", "Flood water can arrive within a day.", "Today"),
        ("medium", "Keep a phone charged and follow local warnings", "Local authorities send evacuation alerts.", "Today"),
    ],
}


def assess_flood(inputs: FloodInputs, today: date) -> FloodAssessment:
    score, factors, past, future = score_factors(inputs, today)
    level = score_to_level(score)

    # Explain with the two factors that pushed the score up most, but never alarm a farmer
    # whose overall risk is low: then lead with why it's low.
    top = sorted(factors, key=lambda f: f.score * f.weight, reverse=True)[:2]
    if level == "safe":
        explanation = f"Little rain is around ({past + future:.0f} mm over these 6 days), so flooding is unlikely."
        if inputs.elevation_m is not None and inputs.elevation_m <= 12:
            explanation += " Your field is low-lying, so heavy rain would still be worth watching."
    else:
        reasons = [f.detail for f in top if f.score >= 25]
        explanation = (". ".join(reasons) + ".") if reasons else "Some rain is around. Keep an eye on the forecast."

    upcoming = [r for r in inputs.rain if today < r.date <= today + timedelta(days=3)]
    wettest = max(upcoming, key=lambda r: r.mm, default=None)
    headline = HEADLINES[level]
    if wettest and wettest.mm >= 50:
        headline += f" Heaviest rain expected {wettest.date.strftime('%A')} ({wettest.mm:.0f} mm)."

    has_rain = any(f.id == "rain" and f.source != "none" for f in factors)
    ids = {f.id for f in factors}
    if has_rain and {"saturation", "terrain", "anomaly"} <= ids and inputs.saturation_source == "smap":
        confidence: Confidence = "high"
    elif has_rain and len(ids) >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    return FloodAssessment(
        score=score,
        level=level,
        headline=headline,
        explanation=explanation,
        factors=factors,
        confidence=confidence,
        rain_past3_mm=round(past, 1),
        rain_next3_mm=round(future, 1),
        wettest_day=wettest,
        advice=ADVICE[level],
    )


def flood_trend(inputs: FloodInputs, today: date, days: int = 14) -> list[int]:
    """Daily scores for the last `days` days (oldest first), recomputed with the rain that
    actually fell (or is forecast) around each day."""
    return [score_factors(inputs, today - timedelta(days=days - 1 - i))[0] for i in range(days)]
