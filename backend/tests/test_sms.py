"""The SMS a farmer on a basic phone would get: when it's sent, what it says, how it's counted."""

import re

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.sms import sms_length, sms_parts

client = TestClient(create_app())
LATIN = re.compile(r"[A-Za-z]")


def sms(farm_id: str, lang: str = "en") -> dict:
    return {s["lang"]: s for s in client.get(f"/api/v1/farms/{farm_id}/dashboard", params={"lang": lang}).json()["sms"]}


# --- counting, as phone networks do ------------------------------------------------------------


def test_plain_english_uses_the_gsm_alphabet_and_bengali_needs_unicode():
    assert sms_length("Irrigate today.") == (15, False)
    assert sms_length("Price: 5€") == (10, False)  # € is a GSM extension: two slots
    assert sms_length("Check in 2–3 days") == (17, True)  # an en dash alone forces Unicode
    assert sms_length("সেচ দিন") == (7, True)


def test_one_sms_holds_160_gsm_or_70_unicode_characters():
    assert sms_parts("a" * 160) == (160, 1, 160)
    assert sms_parts("a" * 161) == (161, 2, 160)  # split parts hold 153 each
    assert sms_parts("ক" * 70) == (70, 1, 70)
    assert sms_parts("ক" * 71) == (71, 2, 70)  # split parts hold 67 each
    assert sms_parts("ক" * 135) == (135, 3, 70)


# --- the day's message ------------------------------------------------------------------------


def test_a_danger_sends_the_summary_and_the_most_urgent_advice_in_both_languages():
    # Demo scenario: the haor's flood risk is the danger behind the day's summary.
    messages = sms("sunamganj-haor")
    assert messages["en"]["text"] == "Haor Rice Field\nAct today: flood risk is high. Harvest ripe rice now."
    assert messages["bn"]["text"] == "আজই ব্যবস্থা নিন: বন্যার ঝুঁকি বেশি। পাকা ধান এখনই কেটে ফেলুন।"
    assert (messages["en"]["parts"], messages["en"]["single_limit"]) == (1, 160)
    assert (messages["bn"]["parts"], messages["bn"]["single_limit"]) == (1, 70)
    assert not LATIN.search(messages["bn"]["text"])


def test_the_field_name_is_added_only_when_it_still_fits_in_one_sms():
    messages = sms("barind-wheat")
    assert messages["en"]["text"].startswith("Barind Wheat Farm\n")  # 160 characters leave room
    assert messages["bn"]["length"] <= 70 and "\n" not in messages["bn"]["text"]  # 70 don't


def test_a_calm_field_gets_no_sms():
    for farm in ("bogura-potato", "dhaka-tomato"):  # safe and watch in the demo scenario
        assert all(not m["send"] and m["text"] == "" for m in sms(farm).values())


def test_both_languages_come_with_either_page_language():
    assert sms("barind-wheat", "bn") == sms("barind-wheat", "en")


def test_a_rising_crop_risk_never_reads_like_good_news():
    # "Prepare now: crop health is rising" sounded like the crop was getting healthier.
    messages = sms("cumilla-aman")
    assert messages["en"]["text"].split("\n")[-1].startswith("Prepare now: crop risk is rising.")
    assert messages["bn"]["text"].startswith("এখনই প্রস্তুতি নিন: ফসলের ঝুঁকি বাড়ছে।")
