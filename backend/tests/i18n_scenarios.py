"""Every farmer-facing sentence the risk engines can produce, across a wide grid of conditions.

Used by the Bengali coverage test: if an engine learns a new sentence, the test lists it.
"""

from collections.abc import Iterator
from itertools import product

from app.data.crops import CROPS
from app.data.sample.farms import SAMPLE_FARMS
from app.risk.crop import PROFILES, assess_crop
from app.risk.flood import ADVICE as FLOOD_ADVICE
from app.risk.flood import HEADLINES as FLOOD_HEADLINES
from app.risk.flood import assess_flood
from app.risk.water import assess_water
from app.services.risk import MODULE_NAMES, overall_summary
from tests.test_crop import TODAY as CROP_TODAY
from tests.test_crop import inputs as crop_inputs
from tests.test_flood import TODAY as FLOOD_TODAY
from tests.test_flood import inputs as flood_inputs
from tests.test_flood import rain_days
from tests.test_water import TODAY as WATER_TODAY
from tests.test_water import inputs as water_inputs
from tests.test_water import rain as water_rain


def _assessment_texts(a) -> Iterator[str]:
    yield a.headline
    yield a.explanation
    if getattr(a, "status", None):
        yield a.status
    for f in a.factors:
        yield f.label
        yield f.detail
    for _priority, title, reason, due in a.advice:
        yield from (title, reason, due)
    if action := getattr(a, "action", None):
        yield action.title
        yield action.detail


def flood_texts() -> Iterator[str]:
    patterns = [{}, {-1: 5}, {-2: 30, 1: 20}, {-1: 60, 1: 80, 2: 90}, {1: 160, 2: 120}, {-3: 15, -2: 15, -1: 15}]
    for rain, sat, elev, normal in product(patterns, [None, 0.3, 0.65, 0.9], [None, 5.0, 20.0, 45.0], [2.0, 10.0]):
        yield from _assessment_texts(assess_flood(flood_inputs(rain_days(rain), saturation=sat, elevation=elev, normal=normal), FLOOD_TODAY))
    yield from FLOOD_HEADLINES.values()
    for advice in FLOOD_ADVICE.values():
        for _p, title, reason, due in advice:
            yield from (title, reason, due)


def water_texts() -> Iterator[str]:
    rains = [water_rain(default=0.0), water_rain(default=3.0), water_rain({-12: 25}), water_rain({-2: 30}), water_rain({1: 15, 2: 20}), water_rain({-40: 30})]
    for r, surface, root, tmax, ndvi in product(rains, [None, 0.2, 0.45, 0.7], [None, 0.4, 0.85], [26.0, 32.0, 37.0], [None, 0.5, 0.95]):
        yield from _assessment_texts(assess_water(water_inputs(rain_series=r, surface=surface, root=root, tmax=tmax, ndvi=ndvi), WATER_TODAY))


def crop_texts() -> Iterator[str]:
    views = [None, {-20: 0.72, -4: 0.74}, {-20: 0.7, -4: 0.4}, {-40: 0.6, -24: 0.65}, {-30: 0.05}, {-120: 0.6}, {-8: 0.66}]
    for crop, tmax, humidity, ndvi, stress in product(
        [c.name for c in CROPS] + ["Sugarcane"], [26.0, 33.0, 39.0], [None, 80.0, 96.0], views, [(10, 10), (60, 20), (20, 70), (90, 90)]
    ):
        tmean = tmax - 6
        a = assess_crop(crop_inputs(crop=crop, tmax=tmax, tmean=tmean, humidity=humidity, ndvi=ndvi, water=stress[0], flood=stress[1]), CROP_TODAY)
        yield from _assessment_texts(a)
    for profile in PROFILES.values():
        yield from profile.disease_advice


def overall_texts() -> Iterator[str]:
    for level, module in product(["safe", "watch", "warning", "danger"], MODULE_NAMES):
        yield overall_summary(level, module)


def sample_farm_texts() -> Iterator[str]:
    for sample in SAMPLE_FARMS.values():
        farm = sample["farm"]
        yield from (farm["name"], farm["story"], farm["crop"])
        for module in sample["modules"].values():
            yield from (module["title"], module["headline"], module["explanation"])
            for label, *_ in module["metrics"]:
                yield label
        for _id, _module, _priority, title, reason, due in sample["recommendations"]:
            yield from (title, reason, due)


def all_texts() -> set[str]:
    texts: set[str] = set()
    for gen in (flood_texts, water_texts, crop_texts, overall_texts, sample_farm_texts):
        texts.update(t for t in gen() if t)
    return texts
