"""Water stress (drought) engine: an explainable scorecard plus an irrigation decision.

Factors, each 0–100 (higher = more stress), weighted:

  topsoil drying     25%  SMAP soil moisture (else NASA POWER surface wetness)
  roots are thirsty  20%  NASA POWER root-zone wetness
  rain shortfall     20%  last 30 days of rain vs the NASA POWER normal
  heat               15%  daily highs around today (POWER + forecast)
  no rain coming     10%  forecast rain for the next 5 days
  plants show stress 10%  MODIS NDVI vs the VIIRS seasonal normal (clear views only)

Missing factors drop out and weights re-normalise (lowering confidence). A recent soaking
caps the score at "safe": wet soil after heavy rain is not a drought, whatever the heat.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from app.risk.flood import DailyRain, Factor
from app.services.risk import clamp_score, score_to_level

Confidence = Literal["high", "medium", "low"]
ActionKind = Literal["irrigate", "hold", "check", "none"]

WEIGHTS = {"surface": 0.25, "root": 0.20, "shortfall": 0.20, "heat": 0.15, "no_rain": 0.10, "plants": 0.10}
GOOD_RAIN_MM = 10  # a day that meaningfully wets the root zone
HOLD_RAIN_MM = 20  # forecast rain in the next 3 days that makes irrigation wasteful
MAX_AGE = {"surface": 5, "root": 6, "ndvi": 32}  # days a reading stays usable


@dataclass(frozen=True)
class Reading:
    value: float
    source: str


@dataclass(frozen=True)
class WaterInputs:
    rain: list[DailyRain]  # observed + forecast
    surface: dict[date, Reading]  # 0–1 topsoil wetness (SMAP ÷ porosity, or POWER)
    root: dict[date, Reading]  # 0–1 root-zone wetness
    tmax: dict[date, Reading]  # daily high °C (observed or forecast)
    normals: dict[int, float]  # month → normal mm/day
    ndvi: dict[date, Reading] = field(default_factory=dict)  # clear-sky NDVI
    ndvi_normal: dict[date, float] = field(default_factory=dict)


@dataclass(frozen=True)
class IrrigationAction:
    kind: ActionKind
    title: str
    detail: str


@dataclass
class WaterAssessment:
    score: int
    level: str
    status: str  # plain-language water status
    headline: str
    explanation: str
    factors: list[Factor]
    confidence: Confidence
    action: IrrigationAction
    days_since_good_rain: int | None
    rain_next5_mm: float
    # Latest topsoil reading used (0–1) and which sources supplied recent rain.
    topsoil: Reading | None = None
    rain_sources: list[str] = field(default_factory=list)
    advice: list[tuple[str, str, str, str]] = field(default_factory=list)


def _clamp01(x: float) -> float:
    return min(1.0, max(0.0, x))


def _latest(series: dict[date, Reading], day: date, max_age: int, prefer: str | None = None) -> tuple[date, Reading] | None:
    """Newest reading within `max_age` days. With `prefer`, a fresh reading from that source
    wins over newer ones from others: mixing sensors day to day makes the trend zig-zag."""
    candidates = [d for d in series if day - timedelta(days=max_age) <= d <= day]
    preferred = [d for d in candidates if series[d].source == prefer] if prefer else []
    pool = preferred or candidates
    return (max(pool), series[max(pool)]) if pool else None


def _rain_by_day(inputs: WaterInputs) -> dict[date, float]:
    return {r.date: r.mm for r in inputs.rain}


def days_since_good_rain(inputs: WaterInputs, day: date, horizon: int = 60) -> int | None:
    rain = _rain_by_day(inputs)
    for back in range(horizon):
        if rain.get(day - timedelta(days=back), 0) >= GOOD_RAIN_MM:
            return back
    return None if not any(d <= day for d in rain) else horizon


def score_factors(inputs: WaterInputs, day: date) -> tuple[int, list[Factor]]:
    rain = _rain_by_day(inputs)
    factors: list[Factor] = []

    if surface := _latest(inputs.surface, day, MAX_AGE["surface"], prefer="smap"):
        wet = surface[1].value
        words = "moist" if wet >= 0.6 else "drying out" if wet >= 0.4 else "dry"
        factors.append(Factor("surface", "Topsoil drying", round(100 * _clamp01((0.75 - wet) / 0.5)), WEIGHTS["surface"], f"The topsoil is {wet * 100:.0f}% wet ({words})", surface[1].source))

    if root := _latest(inputs.root, day, MAX_AGE["root"]):
        wet = root[1].value
        factors.append(Factor("root", "Roots are thirsty", round(100 * _clamp01((0.8 - wet) / 0.45)), WEIGHTS["root"], f"Water around the roots is at {wet * 100:.0f}%", root[1].source))

    past30 = [day - timedelta(days=i) for i in range(30)]
    if inputs.normals and all(d in rain for d in past30[:25]):  # allow a few missing recent days
        fallen = sum(rain.get(d, 0.0) for d in past30)
        normal = sum(inputs.normals.get(d.month, 0.0) for d in past30)
        ratio = fallen / normal if normal else 1.0
        since = days_since_good_rain(inputs, day)
        since_text = f" Last good rain: {since} days ago" if since is not None and since > 3 else ""
        factors.append(
            Factor("shortfall", "Rain shortfall", round(100 * _clamp01(1 - ratio)), WEIGHTS["shortfall"], f"{fallen:.0f} mm fell in the last 30 days, {ratio * 100:.0f}% of normal.{since_text}", "nasa_power_climatology")
        )

    temps = [inputs.tmax[d] for d in (day + timedelta(days=i) for i in range(-2, 4)) if d in inputs.tmax]
    if len(temps) >= 3:
        avg = sum(t.value for t in temps) / len(temps)
        words = "so crops lose water fast" if avg >= 35 else "warm growing weather" if avg >= 30 else "mild"
        factors.append(
            Factor("heat", "Heat", round(100 * _clamp01((avg - 30) / 10)), WEIGHTS["heat"], f"Days are around {avg:.0f}°C, {words}", " + ".join(sorted({t.source for t in temps})))
        )

    next5 = [day + timedelta(days=i) for i in range(1, 6)]
    if all(d in rain for d in next5):
        coming = sum(rain[d] for d in next5)
        factors.append(Factor("no_rain", "No rain coming", round(100 * _clamp01((30 - coming) / 30)), WEIGHTS["no_rain"], f"{coming:.0f} mm of rain is expected in the next 5 days", "open_meteo"))

    if (ndvi := _latest(inputs.ndvi, day, MAX_AGE["ndvi"])) and inputs.ndvi_normal:
        normal_day = min(inputs.ndvi_normal, key=lambda d: abs((d - ndvi[0]).days))
        drop = inputs.ndvi_normal[normal_day] - ndvi[1].value
        factors.append(
            Factor("plants", "Plants show stress", round(100 * _clamp01(drop / 0.25)), WEIGHTS["plants"], f"Plants are {abs(drop):.2f} {'below' if drop > 0 else 'above'} their normal greenness", "modis + viirs")
        )

    weight = sum(f.weight for f in factors)
    score = sum(f.score * f.weight for f in factors) / weight if weight else 0

    # A recent soaking is not a drought.
    week = sum(rain.get(day - timedelta(days=i), 0.0) for i in range(7))
    normal_week = inputs.normals.get(day.month, 0.0) * 7
    if normal_week and week >= 1.5 * normal_week:
        score = min(score, 24)
    return clamp_score(score), factors


STATUS = {
    "safe": "Plenty of water",
    "watch": "Getting dry",
    "warning": "Needs water soon",
    "danger": "Very dry",
}
HEADLINES = {
    "safe": "Soil moisture is fine for your crop.",
    "watch": "Soil is drying. Plan your next irrigation.",
    "warning": "Your crop will need water soon.",
    "danger": "Soil is very dry. Irrigate today.",
}


def irrigation_action(level: str, inputs: WaterInputs, today: date) -> IrrigationAction:
    rain = _rain_by_day(inputs)
    next3 = [(d, rain.get(d, 0.0)) for d in (today + timedelta(days=i) for i in range(1, 4))]
    coming = sum(mm for _, mm in next3)
    wettest_day, wettest_mm = max(next3, key=lambda x: x[1])
    if level != "safe" and coming >= HOLD_RAIN_MM:
        return IrrigationAction(
            "hold",
            "Hold off: rain is coming",
            f"About {coming:.0f} mm of rain is expected in the next 3 days (most on {wettest_day.strftime('%A')}). Save your water and pumping cost.",
        )
    if level == "danger":
        return IrrigationAction("irrigate", "Irrigate today", "Water early in the morning or in the evening so less is lost to the heat.")
    if level == "warning":
        return IrrigationAction("irrigate", "Irrigate within 2 days", "Give a full watering rather than a little every day, so water reaches the roots.")
    if level == "watch":
        return IrrigationAction("check", "Check the soil in 2–3 days", "Push a finger 5 cm into the soil. If it feels dry there, irrigate.")
    return IrrigationAction("none", "No irrigation needed", "The soil holds enough water for now. Watering now would waste water and money.")


ADVICE = {
    "safe": [],
    "watch": [("low", "Clean irrigation channels and check the pump", "Be ready to water quickly if the dry spell continues.", "This week")],
    "warning": [("medium", "Cover the soil with straw mulch", "Mulch keeps moisture in the soil for days longer.", "This week")],
    "danger": [
        ("medium", "Cover the soil with straw mulch", "Mulch keeps moisture in the soil for days longer.", "Within 2 days"),
        ("low", "Ask about drought-tolerant varieties", "Your local agriculture office can suggest one for next season.", "Next season"),
    ],
}
ACTION_PRIORITY = {"irrigate": "high", "hold": "medium", "check": "medium", "none": "low"}
ACTION_DUE = {"irrigate": "Today", "hold": "Next 3 days", "check": "In 2–3 days", "none": "This week"}


def assess_water(inputs: WaterInputs, today: date) -> WaterAssessment:
    score, factors = score_factors(inputs, today)
    level = score_to_level(score)
    action = irrigation_action(level, inputs, today)

    top = sorted(factors, key=lambda f: f.score * f.weight, reverse=True)[:2]
    if level == "safe":
        explanation = "The soil and roots have enough water, so no irrigation is needed right now."
    else:
        reasons = [f.detail.rstrip(".") for f in top if f.score >= 25]
        explanation = (". ".join(reasons) + ".") if reasons else "The soil is slowly drying."

    ids = {f.id for f in factors}
    surface_source = next((f.source for f in factors if f.id == "surface"), None)
    if {"surface", "root", "shortfall", "heat"} <= ids and surface_source == "smap":
        confidence: Confidence = "high"
    elif len(ids) >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    rain = _rain_by_day(inputs)
    advice = []
    if action.kind != "none" or level == "safe":
        advice.append((ACTION_PRIORITY[action.kind], action.title, action.detail, ACTION_DUE[action.kind]))
    advice.extend(ADVICE[level])

    return WaterAssessment(
        score=score,
        level=level,
        status=STATUS[level],
        headline=HEADLINES[level] if action.kind != "hold" else f"{HEADLINES[level]} Rain is coming, so hold off watering.",
        explanation=explanation,
        factors=factors,
        confidence=confidence,
        action=action,
        days_since_good_rain=days_since_good_rain(inputs, today),
        rain_next5_mm=round(sum(rain.get(today + timedelta(days=i), 0.0) for i in range(1, 6)), 1),
        topsoil=(latest[1] if (latest := _latest(inputs.surface, today, MAX_AGE["surface"], prefer="smap")) else None),
        rain_sources=sorted({r.source for r in inputs.rain if today - timedelta(days=30) <= r.date <= today}),
        advice=advice,
    )


def water_trend(inputs: WaterInputs, today: date, days: int = 14) -> list[int]:
    return [score_factors(inputs, today - timedelta(days=days - 1 - i))[0] for i in range(days)]
