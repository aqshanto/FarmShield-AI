"""The SMS a farmer on a basic phone would get: when it's sent, what it says, how it's counted."""

import asyncio
import re
from datetime import UTC, datetime

import httpx2
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import create_app
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.pipeline.store import ObservationStore
from app.services.sms import sms_length, sms_parts
from app.services.sms_delivery import write_daily_sms

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


# --- the daily log and real sends ---------------------------------------------------------------

NOW = datetime(2026, 10, 30, 3, 0, tzinfo=UTC)  # 9 am in Bangladesh
TEAM = "+8801700000001,+8801700000002"


def twilio(code: int = 0, sent: list | None = None):
    """A fake Twilio: accepts every message, or refuses each with an error code."""

    def handler(request):
        if sent is not None:
            sent.append(dict(httpx2.QueryParams(request.content.decode())))
        if code:
            return httpx2.Response(400, json={"code": code, "message": "The number +8801700000001 is unverified."})
        return httpx2.Response(201, json={"sid": "SM1", "status": "queued"})

    return lambda: httpx2.AsyncClient(transport=httpx2.MockTransport(handler))


def setup(client_factory=None, **settings):
    pipeline = PipelineService(ObservationStore(":memory:"), [], client_factory=client_factory or twilio(), now=lambda: NOW)
    app = create_app()
    app.dependency_overrides[get_pipeline] = lambda: pipeline
    app.dependency_overrides[get_settings] = lambda: Settings(data_mode="sample", **settings)
    return pipeline, TestClient(app)


REAL = {"twilio_account_sid": "AC1", "twilio_auth_token": "secret", "twilio_from": "+15550001111", "sms_test_numbers": TEAM}


def test_the_daily_log_writes_each_farm_once_a_day():
    pipeline, api = setup()
    assert asyncio.run(write_daily_sms(pipeline, "sample")) == 5
    assert asyncio.run(write_daily_sms(pipeline, "sample")) == 0  # already written today

    [haor] = api.get("/api/v1/sms/history/sunamganj-haor", params={"lang": "bn"}).json()
    assert (haor["channel"], haor["status"], haor["day"]) == ("daily", "alert", "2026-10-30")
    assert haor["text"].startswith("আজই ব্যবস্থা নিন")
    [bogura] = api.get("/api/v1/sms/history/bogura-potato").json()
    assert (bogura["status"], bogura["text"]) == ("quiet", "")


def test_real_sms_needs_the_keys_and_the_team_numbers():
    _, api = setup()
    assert api.get("/api/v1/sms/status").json() == {"real_sending": False, "phones": 0, "sent_today": 0, "daily_limit": 10}
    response = api.post("/api/v1/sms/send/sunamganj-haor")
    assert response.status_code == 409 and "isn't set up" in response.json()["detail"]


def test_a_real_send_texts_only_the_team_numbers_in_bengali():
    sent: list[dict] = []
    pipeline, api = setup(twilio(sent=sent), **REAL)
    assert api.get("/api/v1/sms/status").json()["phones"] == 2

    response = api.post("/api/v1/sms/send/sunamganj-haor")
    assert response.json() == {"sent": 2, "failed": 0, "message": "Sent to 2 phones."}
    assert [m["To"] for m in sent] == TEAM.split(",")
    assert sent[0]["Body"] == "আজই ব্যবস্থা নিন: বন্যার ঝুঁকি বেশি। পাকা ধান এখনই কেটে ফেলুন।"
    assert sent[0]["From"] == "+15550001111"

    [log] = api.get("/api/v1/sms/history/sunamganj-haor", params={"lang": "bn"}).json()
    assert (log["channel"], log["status"], log["detail"]) == ("real", "sent", "2 sent, 0 failed")
    assert api.get("/api/v1/sms/status").json()["sent_today"] == 2  # one message per phone


def test_a_refused_send_explains_why_without_showing_the_number():
    _, api = setup(twilio(code=21608), **REAL)
    response = api.post("/api/v1/sms/send/sunamganj-haor")
    assert response.status_code == 502
    [log] = api.get("/api/v1/sms/history/sunamganj-haor").json()
    assert log["status"] == "failed"
    assert log["detail"] == "0 sent, 2 failed: a trial account can only text verified numbers"
    assert "+880" not in str(api.get("/api/v1/sms/history/sunamganj-haor").json())


def test_no_real_send_without_an_alert_or_over_the_daily_limit():
    _, api = setup(**REAL)
    assert "nothing needs action" in api.post("/api/v1/sms/send/bogura-potato").json()["detail"]

    _, api = setup(**{**REAL, "sms_daily_limit": 3})
    assert api.post("/api/v1/sms/send/sunamganj-haor").status_code == 200  # 2 of 3
    response = api.post("/api/v1/sms/send/sunamganj-haor")  # 2 more would pass the limit
    assert response.status_code == 409 and "limit" in response.json()["detail"]
