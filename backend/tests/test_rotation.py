import re
from datetime import date

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.i18n.localize import localize_rotation
from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.models import Observation
from app.risk import rotation as engine
from app.risk.rotation import FieldFacts, MonthNormal
from tests.test_flood import pipeline_with

LATIN = re.compile(r"[A-Za-z]")

# Typical north Bangladesh normals (Bogura-like): rain mm/day, normal daily high, low.
BOGURA = {
    1: (0.3, 24, 11), 2: (0.7, 27, 14), 3: (1.3, 32, 19), 4: (3.5, 34, 23), 5: (8.5, 33, 25), 6: (12.0, 32, 26),
    7: (13.0, 31, 26), 8: (11.0, 32, 26), 9: (9.0, 32, 25), 10: (4.0, 31, 22), 11: (0.6, 29, 17), 12: (0.2, 26, 13),
}
# Cool, frosty winters with summer rain (a temperate plain).
TEMPERATE = {
    1: (1.0, 4, -5), 2: (1.2, 6, -4), 3: (1.5, 12, 0), 4: (2.0, 18, 5), 5: (2.8, 23, 10), 6: (3.5, 27, 15),
    7: (4.0, 29, 18), 8: (3.6, 28, 17), 9: (2.5, 24, 12), 10: (1.8, 17, 6), 11: (1.4, 10, 1), 12: (1.1, 5, -3),
}


def climate(table) -> dict[int, MonthNormal]:
    return {m: MonthNormal(*v) for m, v in table.items()}


def bd_field(crop="Boro rice", elevation=20.0, greenness=None) -> FieldFacts:
    return FieldFacts(True, crop, climate(BOGURA), elevation_m=elevation, greenness_ratio=greenness)


def all_text(p) -> list[str]:
    out = list(p.notes)
    for s in [p.existing, *p.alternatives]:
        out += [s.verdict, *s.why, *s.evidence, *s.benefits, *s.gaps, *s.risks]
    return out


# --- engine ----------------------------------------------------------------------------------


def test_compares_the_current_rotation_with_three_alternatives():
    p = engine.plan(bd_field())
    assert p.existing.id == "boro-fallow-aman" and p.existing.verdict == "Your rotation now"
    assert len(p.alternatives) == 3
    assert len({s.name for s in p.alternatives}) == 3
    assert p.existing.bare_months == [5, 6, 11, 12]
    for s in [p.existing, *p.alternatives]:
        assert s.why and s.evidence and s.benefits and s.gaps and s.risks
        assert set(s.scores) == set(engine.METRICS)
        assert all(0 <= v <= 100 for v in s.scores.values())
    # Every plan asks for local checks: we never know the soil test.
    assert all(any("soil test" in g for g in s.gaps) for s in p.alternatives)


def test_legume_rotations_beat_boro_on_soil_and_water():
    p = engine.plan(bd_field())
    best = p.alternatives[0]
    assert best.overall > p.existing.overall
    assert best.verdict == "Best match for your priorities"
    assert best.scores["soil"] > p.existing.scores["soil"]
    assert best.irrigation_mm < p.existing.irrigation_mm
    assert any(c.crop.family == "legume" for c in best.slots)


def test_each_priority_brings_its_own_best_idea():
    income = engine.plan(bd_field(), {"income"})
    every = engine.bangladesh_strategies()
    for s in every:
        engine.score(bd_field(), s, {"income"}, True)
    best_income = max(s.scores["income"] for s in every if s.id != "boro-fallow-aman")
    assert any(s.scores["income"] == best_income for s in income.alternatives)
    assert any("potato" in s.id or "tomato" in s.id for s in income.alternatives)
    food = engine.plan(bd_field(), {"food"})
    assert food.alternatives != income.alternatives


def test_without_irrigation_thirsty_rotations_lose_and_say_why():
    with_water = engine.plan(bd_field())
    without = engine.plan(bd_field(), irrigation=False)
    assert without.existing.scores["water"] < with_water.existing.scores["water"]
    assert "This rotation needs dry-season irrigation, which you said you don't have" in without.existing.risks


def test_low_land_warns_about_floods_and_tired_soil_favours_legumes():
    p = engine.plan(bd_field(crop="Wheat", elevation=6.0, greenness=0.7), existing_id="wheat-mungbean-aman")
    assert p.existing.id == "wheat-mungbean-aman"
    assert any("low land that floods in the monsoon" in n for n in p.notes)
    assert any("less green than normal" in n for n in p.notes)
    assert "Mungbean is sensitive to standing water, and this low field can flood in May" in p.existing.risks
    assert p.wet_months == [5, 6, 7, 8, 9]


def test_the_farmer_can_say_which_rotation_they_grow_now():
    p = engine.plan(bd_field(crop="Potato"))
    assert p.existing.id == "potato-boro-aman"
    assert "potato-boro-aman" in p.existing_options
    other = engine.plan(bd_field(crop="Boro rice"), existing_id="mustard-boro-aman")
    assert other.existing.id == "mustard-boro-aman"
    assert all(s.id != "mustard-boro-aman" for s in other.alternatives)


def test_world_farms_get_seasons_from_their_own_climate():
    f = FieldFacts(False, "Maize", climate(TEMPERATE), relief_m=10.0)
    p = engine.plan(f)
    assert p.existing.id == "maize-only"
    assert len(p.alternatives) == 3
    for s in p.alternatives:
        assert s.scores["climate"] >= 50
        # Frost-sensitive crops are never suggested for frosty months.
        for slot in s.slots:
            if slot.crop.frost_sensitive:
                assert all(TEMPERATE[m][2] >= engine.FROST_C for m in slot.months)
    assert any("drains well" in n for n in p.notes)


# --- Bengali ---------------------------------------------------------------------------------


def rotation_texts():
    fields = [
        bd_field(),
        bd_field(crop="Wheat", elevation=4.0, greenness=0.6),
        bd_field(crop="Tomato", elevation=-2.0),
        FieldFacts(False, "Rice", climate(TEMPERATE), relief_m=2.0, greenness_ratio=0.5),
        FieldFacts(False, "Potato", climate(BOGURA), relief_m=30.0),
    ]
    for f in fields:
        for priorities in [set(), {"soil"}, {"water", "income"}, {"food"}]:
            for irrigation in (True, False):
                yield from all_text(engine.plan(f, priorities, irrigation))
        if f.in_bangladesh:
            for pattern in engine.BANGLADESH_PATTERNS:
                yield from all_text(engine.plan(f, set(), False, pattern.id))


def test_every_rotation_sentence_has_bengali():
    from app.i18n import translate

    untranslated = sorted({t for t in rotation_texts() if LATIN.search(translate(t, "bn"))})
    assert untranslated == [], "Add these to app/i18n/bn.py:\n" + "\n".join(untranslated)


# --- API -------------------------------------------------------------------------------------


def normals(table):
    rows = []
    for m, (rain, high, low) in table.items():
        day = date(2001, m, 1)
        rows += [
            Observation("power_climatology", "precipitation_normal", day, rain, "mm/day"),
            Observation("power_climatology", "temperature_max_normal", day, float(high), "°C"),
            Observation("power_climatology", "temperature_min_normal", day, float(low), "°C"),
        ]
    return rows


def client_for(pipe, mode="live") -> TestClient:
    app = create_app()
    app.dependency_overrides[get_pipeline] = lambda: pipe
    app.dependency_overrides[get_settings] = lambda: Settings(data_mode=mode)
    return TestClient(app)


def test_rotation_endpoint_in_english_and_bengali():
    pipe = pipeline_with({
        "power_climatology": normals(BOGURA),
        "srtm": [Observation("srtm", "elevation", date(2000, 2, 11), 7.0, "m")],
    })
    client = client_for(pipe)
    body = client.get("/api/v1/farms/sunamganj-haor/rotation", params={"priorities": "water,nonsense"}).json()
    assert body["crop"] == "Boro rice" and body["in_bangladesh"] is True
    assert body["priorities"] == ["water"]
    assert body["existing_id"] == "boro-fallow-aman"
    assert [s["existing"] for s in body["strategies"]] == [True, False, False, False]
    assert len(body["climate"]) == 12 and body["wet_months"]
    assert any(o["id"] == "boro-fallow-aman" for o in body["existing_options"])
    assert body["strategies"][0]["crops"][0] == {"id": "boro", "name": "Boro rice", "months": [1, 2, 3, 4]}

    chosen = client.get("/api/v1/farms/sunamganj-haor/rotation", params={"existing": "mustard-boro-aman", "irrigation": "false"}).json()
    assert chosen["existing_id"] == "mustard-boro-aman" and chosen["irrigation"] is False

    bn = client.get("/api/v1/farms/sunamganj-haor/rotation", params={"lang": "bn"}).json()
    texts = [bn["crop"], *bn["field_notes"], *(o["name"] for o in bn["existing_options"])]
    for s in bn["strategies"]:
        texts += [s["name"], s["verdict"], *s["why"], *s["evidence"], *s["benefits"], *s["gaps"], *s["risks"]]
        texts += [c["name"] for c in s["crops"]]
    assert [t for t in texts if LATIN.search(t)] == []


def test_rotation_endpoint_errors():
    pipe = pipeline_with({"power_climatology": normals(BOGURA)})
    assert client_for(pipe).get("/api/v1/farms/nowhere/rotation").status_code == 404
    assert client_for(pipe, mode="sample").get("/api/v1/farms/sunamganj-haor/rotation").status_code == 409
    assert client_for(pipeline_with({})).get("/api/v1/farms/sunamganj-haor/rotation").status_code == 503
