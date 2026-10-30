"""Rotation planner: compare a farm's current rotation with alternatives, explainably.

The challenge asks for a supportive tool that compares at least three rotation strategies,
including the existing one, and says for each why it was suggested, what evidence supports
it, what it may offer, where information is missing, and which risks need local review.

Evidence comes from NASA data for the field:
  climate      NASA POWER long-term monthly normals: rain, normal daily high and low
  terrain      NASA SRTM: height above sea level (Bangladesh) or above the lowest land nearby
  greenness    NASA MODIS NDVI against the VIIRS seasonal normal

Strategies are scored 0–100 on six things farmers weigh (soil health, water use, climate fit,
pest-cycle break, income, family food); the farmer's priorities double the weight of what
they care about. Crop facts are typical values for Bangladesh agriculture (see
docs/DECISIONS.md) and are meant to be reviewed with local experts, which every plan says.

In Bangladesh the strategies are real, common cropping patterns with their usual months.
Elsewhere the year is split into three seasons from the place's own climate (starting with
its wettest four months) and each season gets the crops that suit it.

Haor land (the north-east wetland basin) is different: it lies under deep water for about
half the year, so it grows one crop, Boro rice, in the dry months. A Bangladesh field is
treated as haor when it is low (SRTM), the rains already arrive in April and the monsoon
peak is very heavy (POWER): the pre-monsoon flash floods are what set the haor apart from
other low floodplains such as Barisal, where the rains start a month later. On haor land
every idea uses the dry months only, and the flooded months are shown as water, not as a
bare field.
"""

from dataclasses import dataclass, field
from itertools import product

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
DAYS_PER_MONTH = 30.4
WET_MM_PER_DAY = 8  # a month this wet floods low land
LOW_LAND_M = 12  # Bangladesh: fields this close to sea level flood first
LOW_RELIEF_M = 4  # elsewhere: this close to the lowest land nearby
HAOR_EARLY_MONTH = 4  # haor: the rains (and flash floods from the hills) already arrive in April…
HAOR_PEAK_MM_DAY = 16  # …and the monsoon peak is this wet (about 490 mm a month)
FROST_C = 2
WEIGHTS = {"soil": 0.25, "water": 0.20, "climate": 0.20, "pests": 0.10, "income": 0.15, "food": 0.10}
PRIORITIES = {"soil": "soil", "water": "water", "income": "income", "food": "food"}
METRICS = list(WEIGHTS)


@dataclass(frozen=True)
class CropFacts:
    id: str
    word: str  # the crop in sentences (and the translation catalog): rice, wheat, …
    name: str  # what farmers call it: "Boro rice", "Wheat"
    family: str  # cereal, legume, brassica, solanaceae, fibre
    tmax: tuple[float, float]  # comfortable normal daily highs over its months, °C
    water_mm: int  # typical water need over its season
    flood_tolerance: float  # 0–1: copes with standing water
    income: int  # 0–100, typical market value in Bangladesh
    food: int  # 0–100, value as family food
    deep_roots: bool = False
    frost_sensitive: bool = False
    risk: str | None = None  # the one thing to check locally


CROPS: dict[str, CropFacts] = {c.id: c for c in [
    CropFacts("boro", "rice", "Boro rice", "cereal", (22, 34), 1100, 0.6, 60, 95,
              risk="Boro rice depends on groundwater pumping, which is falling in many areas"),
    CropFacts("aman", "rice", "Aman rice", "cereal", (27, 35), 650, 0.8, 55, 95),
    CropFacts("aus", "rice", "Aus rice", "cereal", (27, 36), 600, 0.6, 45, 85),
    CropFacts("rice", "rice", "Rice", "cereal", (24, 35), 900, 0.7, 55, 95),
    CropFacts("wheat", "wheat", "Wheat", "cereal", (18, 28), 350, 0.05, 55, 80,
              risk="Wheat sown after November meets March heat while the grain fills"),
    CropFacts("maize", "maize", "Maize", "cereal", (20, 33), 500, 0.1, 75, 50, deep_roots=True,
              risk="Maize needs good drainage and plenty of fertiliser"),
    CropFacts("potato", "potato", "Potato", "solanaceae", (16, 27), 450, 0.05, 80, 65, frost_sensitive=True,
              risk="Potato needs costly seed and cold storage"),
    CropFacts("tomato", "tomato", "Tomato", "solanaceae", (18, 30), 450, 0.05, 85, 40, frost_sensitive=True,
              risk="Tomato prices swing a lot at harvest time"),
    CropFacts("mustard", "mustard", "Mustard", "brassica", (16, 28), 250, 0.05, 60, 50, deep_roots=True,
              risk="Sow a short-duration mustard so the next crop is not planted late"),
    CropFacts("lentil", "lentil", "Lentil", "legume", (16, 28), 200, 0.0, 65, 75,
              risk="Humid winter weeks can bring Stemphylium blight in lentil"),
    CropFacts("mungbean", "mungbean", "Mungbean", "legume", (28, 37), 300, 0.05, 65, 70, frost_sensitive=True,
              risk="Early monsoon rain can spoil mungbean pods at harvest"),
    CropFacts("jute", "jute", "Jute", "fibre", (28, 37), 500, 0.6, 60, 0, deep_roots=True,
              risk="Jute needs a pond or canal nearby to soak (ret) the stems"),
]}

# Common Bangladesh cropping patterns with their usual months (BRRI/BARI cropping systems).
# `tight`: the crops only fit with short-duration varieties.
@dataclass(frozen=True)
class Pattern:
    id: str
    slots: tuple[tuple[str, tuple[int, ...]], ...]
    tight: bool = False


BANGLADESH_PATTERNS = [
    Pattern("boro-fallow-aman", (("boro", (1, 2, 3, 4)), ("aman", (7, 8, 9, 10)))),
    Pattern("mustard-boro-aman", (("mustard", (11, 12)), ("boro", (1, 2, 3, 4)), ("aman", (7, 8, 9, 10))), tight=True),
    Pattern("wheat-fallow-aman", (("wheat", (11, 12, 1, 2)), ("aman", (7, 8, 9, 10)))),
    Pattern("wheat-mungbean-aman", (("wheat", (11, 12, 1, 2)), ("mungbean", (3, 4, 5)), ("aman", (7, 8, 9, 10))), tight=True),
    Pattern("wheat-jute-aman", (("wheat", (11, 12, 1, 2)), ("jute", (4, 5, 6)), ("aman", (7, 8, 9, 10))), tight=True),
    Pattern("lentil-jute-aman", (("lentil", (11, 12, 1, 2)), ("jute", (4, 5, 6)), ("aman", (7, 8, 9, 10))), tight=True),
    Pattern("lentil-aus-aman", (("lentil", (11, 12, 1, 2)), ("aus", (4, 5, 6)), ("aman", (7, 8, 9, 10))), tight=True),
    Pattern("potato-boro-aman", (("potato", (11, 12, 1)), ("boro", (2, 3, 4, 5)), ("aman", (7, 8, 9, 10))), tight=True),
    Pattern("maize-fallow-aman", (("maize", (11, 12, 1, 2, 3)), ("aman", (7, 8, 9, 10)))),
    Pattern("mustard-mungbean-aman", (("mustard", (11, 12, 1)), ("mungbean", (3, 4, 5)), ("aman", (7, 8, 9, 10)))),
    Pattern("tomato-fallow-aman", (("tomato", (11, 12, 1, 2)), ("aman", (7, 8, 9, 10)))),
]
# Haor land: one dry-season window between the flood draining (November) and the April
# flash floods. Single Boro is the haor's own pattern; the others are dry-land crops grown
# on the higher haor edges (BARI haor cropping systems).
HAOR_PATTERNS = [
    Pattern("boro-haor", (("boro", (1, 2, 3, 4)),)),
    Pattern("mustard-boro-haor", (("mustard", (11, 12)), ("boro", (1, 2, 3, 4))), tight=True),
    Pattern("wheat-haor", (("wheat", (11, 12, 1, 2)),)),
    Pattern("maize-haor", (("maize", (11, 12, 1, 2, 3)),)),
    Pattern("lentil-haor", (("lentil", (11, 12, 1, 2)),)),
    Pattern("potato-haor", (("potato", (11, 12, 1)),)),
]
PATTERNS_BY_ID = {p.id: p for p in [*BANGLADESH_PATTERNS, *HAOR_PATTERNS]}
# A farm's crop → the rotation it most likely sits in now (the farmer can pick another).
CURRENT_PATTERN = {
    "boro": "boro-fallow-aman", "aman": "boro-fallow-aman", "aus": "lentil-aus-aman", "wheat": "wheat-fallow-aman",
    "maize": "maize-fallow-aman", "potato": "potato-boro-aman", "mustard": "mustard-boro-aman",
    "lentil": "lentil-jute-aman", "jute": "wheat-jute-aman", "tomato": "tomato-fallow-aman", "rice": "boro-fallow-aman",
}
CURRENT_HAOR_PATTERN = {
    "mustard": "mustard-boro-haor", "wheat": "wheat-haor", "maize": "maize-haor", "lentil": "lentil-haor", "potato": "potato-haor",
}  # everything else on haor land, monsoon crops included, starts from single Boro
WORLD_CROPS = ["rice", "wheat", "maize", "potato", "tomato", "lentil", "mustard", "mungbean", "jute"]


@dataclass(frozen=True)
class MonthNormal:
    rain_mm_day: float
    tmax: float
    tmin: float


@dataclass(frozen=True)
class FieldFacts:
    in_bangladesh: bool
    current_crop: str  # the farm's crop name, e.g. "Boro rice", "Maize"
    climate: dict[int, MonthNormal]  # month 1–12
    elevation_m: float | None = None
    relief_m: float | None = None  # height above the lowest land nearby
    greenness_ratio: float | None = None  # latest clear MODIS NDVI ÷ VIIRS normal


@dataclass
class Slot:
    crop: CropFacts
    months: tuple[int, ...]


@dataclass
class Strategy:
    id: str
    slots: list[Slot]
    tight: bool = False
    existing: bool = False
    scores: dict[str, int] = field(default_factory=dict)
    overall: int = 0
    irrigation_mm: int = 0
    bare_months: list[int] = field(default_factory=list)
    why: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)
    benefits: list[str] = field(default_factory=list)
    gaps: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)
    verdict: str = ""

    @property
    def name(self) -> str:
        return " → ".join(s.crop.name for s in self.slots)


def crop_id_for(name: str) -> str:
    text = name.lower()
    for key in ("boro", "aman", "aus", "mungbean", "wheat", "maize", "potato", "tomato", "mustard", "lentil", "jute", "rice"):
        if key in text:
            return key
    return "rice"


def _clamp(value: float) -> int:
    return round(max(0.0, min(100.0, value)))


def _span(months: tuple[int, ...]) -> tuple[str, str]:
    return MONTH_NAMES[months[0] - 1], MONTH_NAMES[months[-1] - 1]


# --- the field -----------------------------------------------------------------------------


def low_lying(f: FieldFacts) -> bool:
    if not f.in_bangladesh and f.relief_m is not None:
        return f.relief_m <= LOW_RELIEF_M
    return f.elevation_m is not None and f.elevation_m <= LOW_LAND_M


def wet_months(f: FieldFacts) -> list[int]:
    return [m for m in range(1, 13) if m in f.climate and f.climate[m].rain_mm_day >= WET_MM_PER_DAY]


def haor(f: FieldFacts) -> bool:
    if not (f.in_bangladesh and low_lying(f) and len(f.climate) == 12):
        return False
    peak = max(c.rain_mm_day for c in f.climate.values())
    return HAOR_EARLY_MONTH in wet_months(f) and peak >= HAOR_PEAK_MM_DAY


def flood_months(f: FieldFacts) -> list[int]:
    """Haor land: under water from a month after the rains start until a month after they end."""
    return sorted({m % 12 + 1 for m in wet_months(f)}) if haor(f) else []


def season_rain_mm(f: FieldFacts, months: tuple[int, ...]) -> float:
    return sum(f.climate[m].rain_mm_day * DAYS_PER_MONTH for m in months if m in f.climate)


def _mean_tmax(f: FieldFacts, months: tuple[int, ...]) -> float:
    values = [f.climate[m].tmax for m in months if m in f.climate]
    return sum(values) / len(values) if values else 0.0


def climate_fit(f: FieldFacts, slot: Slot) -> int:
    low, high = slot.crop.tmax
    t = _mean_tmax(f, slot.months)
    gap = max(low - t, t - high, 0.0)
    fit = 100 - gap * 100 / 6  # 6°C outside the comfortable range → no fit
    if slot.crop.frost_sensitive and any(f.climate[m].tmin < FROST_C for m in slot.months if m in f.climate):
        fit -= 30
    return _clamp(fit)


def flood_penalty(f: FieldFacts, slot: Slot) -> float:
    wet = any(f.climate[m].rain_mm_day >= WET_MM_PER_DAY for m in slot.months if m in f.climate)
    return (1 - slot.crop.flood_tolerance) * 40 if wet and low_lying(f) else 0.0


# --- strategies ------------------------------------------------------------------------------


def calendar_order(slots: list[Slot], start_month: int) -> list[Slot]:
    return sorted(slots, key=lambda s: (s.months[0] - start_month) % 12)


def bangladesh_strategies(patterns: list[Pattern] = BANGLADESH_PATTERNS) -> list[Strategy]:
    return [
        Strategy(p.id, calendar_order([Slot(CROPS[c], m) for c, m in p.slots], 11), tight=p.tight)
        for p in patterns
    ]


def haor_strategies(flooded: list[int]) -> list[Strategy]:
    """Haor patterns with no crop in the flooded months (all of them, unless the flood runs unusually long)."""
    strategies = bangladesh_strategies(HAOR_PATTERNS)
    dry = [s for s in strategies if not any(m in flooded for sl in s.slots for m in sl.months)]
    return dry or strategies


def world_seasons(f: FieldFacts) -> list[tuple[int, ...]]:
    """Three four-month seasons, starting with the place's wettest four months."""
    def window(start: int) -> tuple[int, ...]:
        return tuple((start - 1 + i) % 12 + 1 for i in range(4))

    wettest = max(range(1, 13), key=lambda s: season_rain_mm(f, window(s)))
    return [window(wettest), window((wettest + 3) % 12 + 1), window((wettest + 7) % 12 + 1)]


def world_strategies(f: FieldFacts, current: str) -> tuple[Strategy, list[Strategy]]:
    seasons = world_seasons(f)

    def options(months: tuple[int, ...], n: int) -> list[str | None]:
        ranked = sorted(WORLD_CROPS, key=lambda c: climate_fit(f, Slot(CROPS[c], months)), reverse=True)
        return [c for c in ranked[:n] if climate_fit(f, Slot(CROPS[c], months)) >= 60] + [None]

    start = seasons[0][0]
    alternatives = []
    for combo in product(options(seasons[0], 4), options(seasons[1], 4), options(seasons[2], 3)):
        slots = [Slot(CROPS[c], m) for c, m in zip(combo, seasons, strict=True) if c]
        if slots:
            alternatives.append(Strategy("-".join(c or "fallow" for c in combo), calendar_order(slots, start)))
    base = current if current in WORLD_CROPS else "rice"
    best_season = max(seasons, key=lambda m: climate_fit(f, Slot(CROPS[base], m)))
    existing = Strategy(f"{base}-only", [Slot(CROPS[base], best_season)], existing=True)
    return existing, alternatives


# --- scoring ----------------------------------------------------------------------------------


def _weights(priorities: set[str]) -> dict[str, float]:
    weights = dict(WEIGHTS)
    for p in priorities:
        if p in PRIORITIES:
            weights[PRIORITIES[p]] *= 2
    return weights


def score(f: FieldFacts, s: Strategy, priorities: set[str], irrigation: bool) -> None:
    # Months under haor floodwater aren't bare: no rain washes soil off land under water.
    covered = {m for slot in s.slots for m in slot.months} | set(flood_months(f))
    s.bare_months = [m for m in range(1, 13) if m not in covered]
    s.irrigation_mm = round(sum(max(0.0, slot.crop.water_mm - season_rain_mm(f, slot.months)) for slot in s.slots))
    fits = [climate_fit(f, slot) - flood_penalty(f, slot) for slot in s.slots]
    families = {slot.crop.family for slot in s.slots}
    legumes = sum(slot.crop.family == "legume" for slot in s.slots)
    rice = sum(slot.crop.word == "rice" for slot in s.slots)
    ordered = s.slots
    repeats = sum(
        ordered[i].crop.family == ordered[(i + 1) % len(ordered)].crop.family for i in range(len(ordered))
    ) if len(ordered) > 1 else 1
    tired = f.greenness_ratio is not None and f.greenness_ratio < 0.85

    water = 100 - s.irrigation_mm / 12
    if not irrigation and s.irrigation_mm > 150:
        water *= 0.3
    s.scores = {
        "soil": _clamp(
            35 + 20 * min(legumes, 2) + (10 * legumes if tired else 0) + 8 * len(families)
            + (8 if any(sl.crop.deep_roots for sl in s.slots) else 0) + (8 if "brassica" in families else 0)
            - 3 * len(s.bare_months) - 12 * max(0, rice - 1)
        ),
        "water": _clamp(water),
        "climate": _clamp(sum(fits) / len(fits)),
        "pests": _clamp(40 + 20 * (len(families) - 1) - 20 * repeats),
        "income": _clamp(sum(sl.crop.income for sl in s.slots) * 0.45),
        "food": _clamp(sum(sl.crop.food for sl in s.slots) * 0.45),
    }
    weights = _weights(priorities)
    s.overall = _clamp(sum(weights[k] * s.scores[k] for k in METRICS) / sum(weights.values()))


# --- explanations ----------------------------------------------------------------------------

WHY = {
    "soil": "Better for the soil than your rotation now",
    "water": "Needs less irrigation water than your rotation now",
    "climate": "Fits this place's climate better than your rotation now",
    "pests": "Breaks pest and disease cycles better than your rotation now",
    "income": "Can earn more than your rotation now",
    "food": "Grows more food for the family than your rotation now",
}


def explain(f: FieldFacts, s: Strategy, existing: Strategy, irrigation: bool) -> None:
    # Why: what it does better than now.
    if s.existing:
        s.why = ["This is what you grow now, used as the baseline"]
    else:
        gains = sorted(((s.scores[k] - existing.scores[k], k) for k in METRICS), reverse=True)
        s.why = [WHY[k] for gain, k in gains[:2] if gain >= 8] or ["Close to your rotation now, with a different mix of crops"]

    # Evidence: NASA data behind it.
    dry = min(s.slots, key=lambda sl: season_rain_mm(f, sl.months))
    first, last = _span(dry.months)
    rain_month = season_rain_mm(f, dry.months) / len(dry.months)
    s.evidence = [f"From {first} to {last} this place usually gets {round(rain_month)} mm of rain a month (NASA POWER)"]
    hottest = max(s.slots, key=lambda sl: _mean_tmax(f, sl.months))
    first, last = _span(hottest.months)
    s.evidence.append(f"Days from {first} to {last} usually reach {round(_mean_tmax(f, hottest.months))}°C (NASA POWER)")
    if s.irrigation_mm >= 50:
        s.evidence.append(f"Needs about {s.irrigation_mm} mm of irrigation a year on top of the usual rain")
    else:
        s.evidence.append("Needs almost no irrigation: the usual rain covers it")

    # Benefits.
    benefits = []
    for slot in s.slots:
        if slot.crop.family == "legume":
            benefits.append(f"{slot.crop.word.capitalize()} puts nitrogen back into the soil, so the next crop needs less fertiliser")
    if "brassica" in {sl.crop.family for sl in s.slots}:
        benefits.append("Mustard breaks the pest and disease cycle of the cereals around it")
    for slot in s.slots:
        if slot.crop.deep_roots and slot.crop.id != "mustard":
            benefits.append(f"{slot.crop.word.capitalize()} has deep roots that open up the soil and let water soak in")
    if not s.existing and len(s.bare_months) < len(existing.bare_months):
        benefits.append(
            f"The field is bare for only {len(s.bare_months)} months a year, so less soil washes away"
            if s.bare_months else "The field is never left bare, so less soil washes away"
        )
    saved = existing.irrigation_mm - s.irrigation_mm
    if not s.existing and saved >= 100:
        benefits.append(f"Saves about {saved} mm of irrigation water a year compared with now")
    for slot in s.slots:
        if slot.crop.income >= 75:
            benefits.append(f"{slot.crop.word.capitalize()} sells well at market")
    s.benefits = list(dict.fromkeys(benefits))[:3]
    if s.existing and not s.benefits:
        s.benefits = ["Familiar crops, tools and markets"]

    # Information gaps.
    on_haor = haor(f)
    s.gaps = ["We don't know your soil type or test results: a soil test would sharpen this"]
    if on_haor:
        s.gaps.append("We can't see how high your field sits inside the haor: higher land drains sooner and can take a winter crop first")
    if s.tight:
        s.gaps.append("Choose short-duration varieties so each crop fits its window")
    elif not s.existing:
        s.gaps.append("Prices change by market and year: check local prices before choosing")

    # Risks to check locally.
    risks = []
    rainy = wet_months(f)
    for slot in s.slots:
        if on_haor and slot.months[-1] in rainy:
            month = MONTH_NAMES[slot.months[-1] - 1]
            risks.append(f"Flash floods from the hills upstream can arrive in {month}, before the {slot.crop.word} is harvested: a short-duration variety is harvested sooner")
    for slot in s.slots:
        if flood_penalty(f, slot) >= 20:
            wet = next(m for m in slot.months if f.climate[m].rain_mm_day >= WET_MM_PER_DAY)
            risks.append(f"{slot.crop.word.capitalize()} is sensitive to standing water, and this low field can flood in {MONTH_NAMES[wet - 1]}")
        hot = [m for m in slot.months if f.climate[m].tmax > slot.crop.tmax[1] + 3]
        if hot:
            risks.append(f"{slot.crop.word.capitalize()} may meet more heat than it likes in {MONTH_NAMES[hot[0] - 1]}")
    if not irrigation and s.irrigation_mm > 150:
        risks.append("This rotation needs dry-season irrigation, which you said you don't have")
    # Haor Boro is watered from the beels and rivers, so the groundwater warning doesn't apply there.
    risks += [slot.crop.risk for slot in s.slots if slot.crop.risk and not (on_haor and slot.crop.id == "boro")]
    s.risks = list(dict.fromkeys(risks))[:3]


def field_notes(f: FieldFacts) -> list[str]:
    notes = []
    height = round(max(0.0, f.elevation_m or 0.0))
    flooded = flood_months(f)
    if flooded:
        first, last = MONTH_NAMES[flooded[0] - 1], MONTH_NAMES[flooded[-1] - 1]
        notes.append(
            f"The field sits {height} m above sea level and the rains arrive early, in {MONTH_NAMES[HAOR_EARLY_MONTH - 1]}: "
            f"like a haor, it stays under deep water from {first} to {last} (NASA SRTM, NASA POWER)"
        )
        notes.append("In the flood months the haor gives fish, not crops, so every idea here uses the dry months only")
    elif f.in_bangladesh and f.elevation_m is not None:
        if low_lying(f):
            notes.append(f"The field sits {height} m above sea level: low land that floods in the monsoon (NASA SRTM)")
        else:
            notes.append(f"The field sits {height} m above sea level, above most monsoon floods (NASA SRTM)")
    elif f.relief_m is not None:
        if low_lying(f):
            notes.append(f"The field sits {round(f.relief_m)} m above the lowest land nearby: water collects here (NASA SRTM)")
        else:
            notes.append(f"The field sits {round(f.relief_m)} m above the lowest land nearby, so it drains well (NASA SRTM)")
    if f.greenness_ratio is not None and f.greenness_ratio < 0.85:
        notes.append("The field looked less green than normal lately (NASA MODIS compared with VIIRS): legumes help tired soil recover")
    return notes


# --- the plan ----------------------------------------------------------------------------------


@dataclass
class Plan:
    existing: Strategy
    alternatives: list[Strategy]
    existing_options: list[str]
    notes: list[str]
    wet_months: list[int]
    flood_months: list[int] = field(default_factory=list)


def plan(f: FieldFacts, priorities: set[str] | None = None, irrigation: bool = True, existing_id: str | None = None) -> Plan:
    priorities = priorities or set()
    current = crop_id_for(f.current_crop)
    flooded = flood_months(f)
    if f.in_bangladesh:
        if flooded:
            strategies, usual = haor_strategies(flooded), CURRENT_HAOR_PATTERN.get(current, "boro-haor")
        else:
            strategies, usual = bangladesh_strategies(), CURRENT_PATTERN.get(current, "boro-fallow-aman")
        ids = [s.id for s in strategies]
        usual = usual if usual in ids else ids[0]
        options = [s.id for s in strategies if any(sl.crop.id == current for sl in s.slots)] or [usual]
        chosen = existing_id if existing_id in ids else usual
        existing = next(s for s in strategies if s.id == chosen)
        existing.existing = True
        alternatives = [s for s in strategies if s.id != chosen]
    else:
        existing, alternatives = world_strategies(f, current)
        options = [existing.id]

    for s in [existing, *alternatives]:
        score(f, s, priorities, irrigation)
    # Only crops that suit this place's climate are suggested.
    suitable = [s for s in alternatives if s.scores["climate"] >= 50] or alternatives
    top = sorted(suitable, key=lambda s: (s.overall, s.scores["soil"]), reverse=True)
    picked: list[Strategy] = []

    def pick(s: Strategy) -> None:
        if len(picked) < 3 and all(s.name != p.name for p in picked):  # different ideas, not near-copies
            picked.append(s)

    pick(top[0]) if top else None
    # Each priority the farmer chose brings its own best idea, so choosing one visibly matters.
    for p in sorted(priorities & set(PRIORITIES)):
        metric = PRIORITIES[p]
        pick(max(suitable, key=lambda s: (s.scores[metric], s.overall)))
    for s in top:
        pick(s)
    picked.sort(key=lambda s: s.overall, reverse=True)
    for s in [existing, *picked]:
        explain(f, s, existing, irrigation)
        delta = s.overall - existing.overall
        s.verdict = "Your rotation now" if s.existing else "Better than now" if delta >= 5 else "Weaker than now" if delta <= -5 else "Similar to now"
    if picked and picked[0].overall > existing.overall:
        picked[0].verdict = "Best match for your priorities"
    return Plan(existing, picked, options, field_notes(f), wet_months(f), flooded)
