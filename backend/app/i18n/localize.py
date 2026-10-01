"""Apply the farmer's language to whole API responses."""

import re

from app.data.crops import CROPS
from app.data.places import DISTRICTS, DIVISIONS
from app.i18n import bn, bn_of, translate
from app.schemas.dashboard import Dashboard, FarmSummary, Recommendation, RiskModuleSummary
from app.schemas.map import MapOverview, PointRisk

CROP_BN = {c.name.lower(): c.name_bn for c in CROPS}
# Source lists mix mission names (kept: GPM, SMAP, NASA POWER…) with plain words.
SOURCE_WORDS_BN = {"Forecast": "পূর্বাভাস", "Water stress": "পানির ঘাটতি", "Flood risk": "বন্যার ঝুঁকি", "water engine": "পানির হিসাব", "flood engine": "বন্যার হিসাব"}
SOURCE_WORDS = re.compile("|".join(re.escape(w) for w in sorted(SOURCE_WORDS_BN, key=len, reverse=True)))
PLACE_BN = {d.name: d.name_bn for d in DISTRICTS} | {d.name: d.name_bn for d in DIVISIONS.values()}


def crop_name(crop: str, lang: str) -> str:
    if lang != "bn":
        return crop
    return CROP_BN.get(crop.lower()) or bn.CROPS.get(crop.lower()) or crop


def source_names(sources: str, lang: str) -> str:
    return SOURCE_WORDS.sub(lambda m: SOURCE_WORDS_BN[m[0]], sources) if lang == "bn" else sources


def place_name(place: str, lang: str) -> str:
    return PLACE_BN.get(place, place) if lang == "bn" else place


def localize_farms(farms: list[FarmSummary], lang: str) -> list[FarmSummary]:
    if lang != "bn":
        return farms
    return [f.model_copy(update={"name": translate(f.name, lang), "district": place_name(f.district, lang), "crop": crop_name(f.crop, lang)}) for f in farms]


def localize_dashboard(d: Dashboard, lang: str, custom_name_given: bool = False) -> Dashboard:
    if lang != "bn":
        return d
    t = lambda text: translate(text, lang)  # noqa: E731
    d = d.model_copy(deep=True)
    farm = d.farm
    crop_bn = crop_name(farm.crop, lang)
    district_bn, division_bn = place_name(farm.district, lang), place_name(farm.division, lang)
    if farm.custom:
        # A farmer's own name stays as typed; our default name and story are re-written.
        if not custom_name_given:
            farm.name = f"আমার {bn_of(crop_bn)} জমি"
        farm.story = f"{bn_of(district_bn)} কাছে, {division_bn} বিভাগে আপনার জমি, নাসার উপগ্রহ থেকে নজর রাখা হচ্ছে।"
    else:
        farm.name = t(farm.name)
        farm.story = t(farm.story)
    farm.crop, farm.district, farm.division = crop_bn, district_bn, division_bn

    d.overall.summary = t(d.overall.summary)
    _modules_and_advice(d.modules, d.recommendations, lang)
    return d


def localize_point(p: PointRisk, lang: str) -> PointRisk:
    """Place names already come from OpenStreetMap in the farmer's language."""
    if lang != "bn":
        return p
    p = p.model_copy(deep=True)
    p.crop = crop_name(p.crop, lang)
    if p.overall:
        p.overall.summary = translate(p.overall.summary, lang)
    _modules_and_advice(p.modules, p.recommendations, lang)
    return p


def _modules_and_advice(modules: list[RiskModuleSummary], recommendations: list[Recommendation], lang: str) -> None:
    """In place: every sentence, label and unit of the risk modules and their advice."""
    t = lambda text: translate(text, lang)  # noqa: E731
    for m in modules:
        m.title, m.headline, m.explanation, m.status = t(m.title), t(m.headline), t(m.explanation), t(m.status)
        m.sources = [source_names(s, lang) for s in m.sources]
        for metric in m.metrics:
            metric.label, metric.unit, metric.source = t(metric.label), t(metric.unit), source_names(metric.source, lang)
        for f in m.factors:
            f.label, f.detail, f.source = t(f.label), t(f.detail), source_names(f.source, lang)
        if m.action:
            m.action.title, m.action.detail = t(m.action.title), t(m.action.detail)
        if m.indicators:
            m.indicators.crop = crop_name(m.indicators.crop, lang)
            m.indicators.disease = bn.DISEASES.get(m.indicators.disease, m.indicators.disease)
    for r in recommendations:
        r.title, r.reason, r.due = t(r.title), t(r.reason), t(r.due)


def localize_overview(o: MapOverview, lang: str) -> MapOverview:
    if lang != "bn":
        return o
    o = o.model_copy(deep=True)
    for layer in o.layers:
        layer.title, layer.description = translate(layer.title, lang), translate(layer.description, lang)
        layer.sources = [source_names(s, lang) for s in layer.sources]
    for f in o.farms:
        f.name, f.district, f.crop = translate(f.name, lang), place_name(f.district, lang), crop_name(f.crop, lang)
        f.overall.summary = translate(f.overall.summary, lang)
    return o
