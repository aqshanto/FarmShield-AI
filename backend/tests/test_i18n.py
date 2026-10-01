import re
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.data.crops import CROPS
from app.i18n import bn_of, translate
from app.i18n.localize import localize_dashboard
from app.main import create_app
from app.services.dashboard import build_dashboard
from tests.i18n_scenarios import all_texts

LATIN = re.compile(r"[A-Za-z]")
CROP_NAMES = {c.name for c in CROPS}  # farm crop names are mapped by the localizer, not the catalog


def test_every_engine_and_demo_sentence_has_bengali():
    untranslated = sorted(t for t in all_texts() if t not in CROP_NAMES and LATIN.search(translate(t, "bn") or ""))
    assert untranslated == [], "Add these to app/i18n/bn.py:\n" + "\n".join(untranslated)


def test_numbers_dates_crops_and_diseases_are_converted():
    assert translate("The topsoil is 46% wet (drying out). 130 mm fell in the last 30 days, 48% of normal.", "bn") == (
        "উপরের মাটি ৪৬% ভেজা (শুকিয়ে আসছে)। গত ৩০ দিনে ১৩০ মিমি বৃষ্টি হয়েছে, স্বাভাবিকের ৪৮%।"
    )
    assert translate("Plants were less green than normal (62% of normal) on 05 Sep", "bn") == "৫ সেপ্টেম্বর তারিখে গাছ স্বাভাবিকের চেয়ে কম সবুজ ছিল (স্বাভাবিকের ৬২%)"
    assert translate("3 of 8 days around today suit late blight", "bn").endswith("নাবি ধসা (লেট ব্লাইট) রোগের অনুকূল")
    assert "আলুর সহ্যের সীমা" in translate("10 of 10 days (last week and next 3) reach 29°C, the limit for potato", "bn")
    assert translate("Heaviest rain expected Friday (96 mm).", "bn") == "সবচেয়ে ভারী বৃষ্টি শুক্রবার হতে পারে (৯৬ মিমি)।"


def test_english_is_untouched_and_unknown_text_falls_back():
    assert translate("Soil is drying.", "en") == "Soil is drying."
    assert translate("Something brand new.", "bn") == "Something brand new."
    assert translate(None, "bn") is None


def test_source_lists_keep_mission_names_and_translate_words():
    from app.i18n.localize import source_names

    assert source_names("Forecast, GPM", "bn") == "পূর্বাভাস, GPM"
    assert source_names("NASA POWER + Forecast", "bn") == "NASA POWER + পূর্বাভাস"
    assert source_names("Forecast, GPM", "en") == "Forecast, GPM"


def test_bengali_possessive():
    assert [bn_of(w) for w in ("ধান", "আলু", "বগুড়া", "রোগ")] == ["ধানের", "আলুর", "বগুড়ার", "রোগের"]


def test_whole_dashboard_in_bengali():
    d = localize_dashboard(build_dashboard("bogura-potato", "sample", now=datetime(2026, 10, 1, 4, tzinfo=UTC)), "bn")
    assert (d.farm.name, d.farm.district, d.farm.division, d.farm.crop) == ("বগুড়ার আলুক্ষেত", "বগুড়া", "রাজশাহী", "আলু")
    texts = [d.farm.story, d.overall.summary]
    for m in d.modules:
        texts += [m.title, m.headline, m.explanation] + [x.label for x in m.metrics] + [x.unit for x in m.metrics]
    for r in d.recommendations:
        texts += [r.title, r.reason, r.due]
    assert [t for t in texts if LATIN.search(t)] == []


def test_api_speaks_the_requested_language():
    client = TestClient(create_app())
    farms = client.get("/api/v1/farms", params={"lang": "bn"}).json()
    assert farms[0] == {"id": "sunamganj-haor", "name": "হাওরের ধানক্ষেত", "district": "সুনামগঞ্জ", "crop": "বোরো ধান"}
    assert client.get("/api/v1/farms").json()[0]["name"] == "Haor Rice Field"

    d = client.get("/api/v1/farms/barind-wheat/dashboard", params={"lang": "bn"}).json()
    assert d["overall"]["summary"].startswith("আজই ব্যবস্থা নিন")
    assert d["modules"][1]["title"] == "পানির ঘাটতি"

    overview = client.get("/api/v1/map/overview", params={"lang": "bn"}).json()
    assert overview["layers"][0]["title"] == "বন্যার ঝুঁকি"
    assert overview["farms"][1]["name"] == "বরেন্দ্রের গমক্ষেত"
    assert client.get("/api/v1/farms", params={"lang": "fr"}).status_code == 422
