import asyncio
import json
from datetime import UTC, date, datetime

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.assistant import get_claude
from app.assistant import offline
from app.assistant.claude import FALLBACK_BETA, SYSTEM_PROMPT, AssistantRefusedError, ClaudeAssistant
from app.assistant.facts import fact_sheet
from app.assistant.service import chat_events, claude_history
from app.main import create_app
from app.schemas.assistant import MAX_CHARS, ChatMessage
from app.schemas.dashboard import RiskAction
from app.services.dashboard import build_dashboard

NOW = datetime(2026, 10, 1, 4, tzinfo=UTC)
TODAY = date(2026, 10, 1)


def dash(farm_id="barind-wheat"):
    return build_dashboard(farm_id, "sample", now=NOW)


def with_water_action(d, kind):
    modules = [
        m.model_copy(update={"action": RiskAction(kind=kind, title="t", detail="d")}) if m.id == "water_stress" else m
        for m in d.modules
    ]
    return d.model_copy(update={"modules": modules})


def collect(gen):
    async def run():
        return [e async for e in gen]

    return asyncio.run(run())


def user(text):
    return ChatMessage(role="user", content=text)


# --- built-in helper -----------------------------------------------------------------


def test_detects_bengali_script_over_the_chosen_language():
    assert offline.detect_lang("সেচ দেব?", "en") == "bn"
    assert offline.detect_lang("Should I irrigate?", "bn") == "bn"
    assert offline.detect_lang("Should I irrigate?", "en") == "en"


@pytest.mark.parametrize(
    ("question", "topic"),
    [
        ("Should I irrigate today?", "water"),
        ("আজ কি সেচ দেব?", "water"),
        ("Is there flood danger this week?", "flood"),
        ("এই সপ্তাহে কি বন্যার ভয় আছে?", "flood"),
        ("Is my crop healthy?", "crop"),
        ("পাতায় দাগ দেখা যাচ্ছে", "crop"),
        ("Will it rain this week?", "weather"),
        ("আগামী সপ্তাহে বৃষ্টি হবে?", "weather"),
        ("আজ কী করব?", "today"),
    ],
)
def test_recognises_topics_in_both_languages(question, topic):
    assert topic in offline.topics_in(question)


def test_bengali_possessive_follows_the_final_sound():
    assert offline.bn_of("আলু") == "আলুর"
    assert offline.bn_of("বগুড়া") == "বগুড়ার"
    assert offline.bn_of("ধান") == "ধানের"
    assert offline.bn_of("সুনামগঞ্জ") == "সুনামগঞ্জের"


@pytest.mark.parametrize(
    ("kind", "en", "bn"),
    [
        ("irrigate", "t. d", "আজই সেচ দিন"),
        ("hold", "t. d", "সেচ দেওয়ার দরকার নেই"),
        ("check", "t. d", "২-৩ দিন পর"),
    ],
)
def test_irrigation_answer_follows_the_water_engine_action(kind, en, bn):
    d = with_water_action(dash(), kind)
    assert en in offline.reply(d, "Should I irrigate today?", TODAY, "en")
    assert bn in offline.reply(d, "সেচ দেব?", TODAY, "bn")


def test_specific_topic_beats_the_daily_summary():
    d = dash()
    answer = offline.reply(d, "Should I irrigate today?", TODAY, "en")
    assert "First job" not in answer
    assert answer.startswith(next(m.headline for m in d.modules if m.id == "water_stress"))


def test_bengali_flood_answer_uses_the_level_and_forecast_in_bengali_digits():
    d = dash("sunamganj-haor")  # demo: flood danger, storms ahead
    answer = offline.reply(d, "বন্যা হবে?", TODAY, "bn")
    assert answer.startswith("বিপদ")
    assert "ভারী বৃষ্টি" in answer
    assert not any(ch.isascii() and ch.isdigit() for ch in answer)


def test_daily_summary_lists_every_risk_and_the_most_urgent_job():
    d = dash()
    answer = offline.reply(d, "আজ কী করব?", TODAY, "bn")
    assert "• বন্যা:" in answer and "• পানি:" in answer and "• ফসল:" in answer
    assert "সবচেয়ে জরুরি:" in answer


def test_greets_thanks_and_admits_what_it_does_not_know():
    d = dash("bogura-potato")
    assert "বগুড়ার জমি" in offline.reply(d, "আসসালামু আলাইকুম", TODAY, "bn")
    assert "welcome" in offline.reply(d, "thanks!", TODAY, "en")
    unknown = offline.reply(d, "Who won the cricket?", TODAY, "en")
    assert unknown.startswith("Sorry") and "16123" in unknown


def test_dry_week_is_described_without_counting_zero_rain_days():
    d = dash("barind-wheat")
    d = d.model_copy(update={"forecast": [f.model_copy(update={"rain_mm": 0.4}) for f in d.forecast]})
    assert "Little or no rain" in offline.reply(d, "Will it rain?", TODAY, "en")
    assert "তেমন বৃষ্টি নেই" in offline.reply(d, "বৃষ্টি হবে?", TODAY, "bn")


# --- fact sheet ------------------------------------------------------------------------


def test_fact_sheet_carries_risks_actions_forecast_and_language():
    d = with_water_action(dash(), "irrigate")
    sheet = fact_sheet(d, TODAY, "bn")
    assert "Farmer's chosen language: Bengali" in sheet
    assert "Barind Wheat Farm" in sheet and "Crop: Wheat" in sheet
    assert "Water for the crop: danger" in sheet
    assert "Do now: t. d" in sheet
    assert "Weather forecast:" in sheet and "Recommended actions" in sheet
    assert "a demo scenario, not today's data" in sheet  # sample modules are labelled honestly
    assert "NDVI" not in sheet


# --- streaming service -----------------------------------------------------------------


class FakeClaude:
    def __init__(self, chunks=(), error=None):
        self.chunks, self.error, self.calls = chunks, error, []

    async def stream(self, facts, messages):
        self.calls.append((facts, messages))
        for c in self.chunks:
            yield c
        if self.error:
            raise self.error


def test_history_starts_with_the_farmer_and_is_clipped():
    msgs = [ChatMessage(role="assistant", content="Hello!"), user("x" * 3000), ChatMessage(role="assistant", content="ok"), user("and?")]
    hist = claude_history(msgs)
    assert [m["role"] for m in hist] == ["user", "assistant", "user"]
    assert len(hist[0]["content"]) == MAX_CHARS


def test_built_in_helper_streams_its_reply_word_by_word():
    d = dash()
    events = collect(chat_events(d, [user("Will it rain?")], "en", TODAY, None, word_delay=0))
    assert events[0] == ("meta", {"engine": "offline", "lang": "en"})
    assert events[-1] == ("done", {"engine": "offline"})
    deltas = [e[1]["text"] for e in events if e[0] == "delta"]
    assert len(deltas) > 5
    assert "".join(deltas) == offline.reply(d, "Will it rain?", TODAY, "en")


def test_claude_reply_is_streamed_with_the_farm_facts():
    fake = FakeClaude(["Yes, ", "irrigate."])
    events = collect(chat_events(dash(), [user("Irrigate?")], "en", TODAY, fake))
    assert events == [("meta", {"engine": "claude", "lang": "en"}), ("delta", {"text": "Yes, "}), ("delta", {"text": "irrigate."}), ("done", {"engine": "claude"})]
    facts, messages = fake.calls[0]
    assert "FARM FACTS" in facts and messages == [{"role": "user", "content": "Irrigate?"}]


@pytest.mark.parametrize(
    "error",
    [AssistantRefusedError(), anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))],
)
def test_claude_failure_falls_back_to_the_built_in_answer(error):
    d = dash()
    events = collect(chat_events(d, [user("বৃষ্টি হবে?")], "en", TODAY, FakeClaude(["partial"], error)))
    kinds = [e[0] for e in events]
    assert kinds == ["meta", "delta", "replace", "done"]
    assert events[2][1] == {"text": offline.reply(d, "বৃষ্টি হবে?", TODAY, "en"), "engine": "offline"}
    assert events[0][1]["lang"] == "bn"


# --- Claude request shape ---------------------------------------------------------------


class FakeStream:
    def __init__(self, chunks, stop_reason):
        self.chunks, self.stop_reason = chunks, stop_reason

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    @property
    async def text_stream(self):  # pragma: no cover - replaced below
        yield ""

    async def get_final_message(self):
        return type("Msg", (), {"stop_reason": self.stop_reason})()


def fake_client(chunks, stop_reason, seen):
    class Stream(FakeStream):
        @property
        def text_stream(self):
            async def gen():
                for c in self.chunks:
                    yield c

            return gen()

    class Messages:
        def stream(self, **kwargs):
            seen.update(kwargs)
            return Stream(chunks, stop_reason)

    return type("Client", (), {"beta": type("Beta", (), {"messages": Messages()})()})()


def test_claude_request_uses_opus_low_effort_fallbacks_and_facts():
    seen = {}
    assistant = ClaudeAssistant(fake_client(["Hi"], "end_turn", seen), "claude-opus-5-5", "low")

    async def run():
        return [t async for t in assistant.stream("FARM FACTS ...", [{"role": "user", "content": "hi"}])]

    assert asyncio.run(run()) == ["Hi"]
    assert seen["model"] == "claude-opus-5-5"
    assert seen["betas"] == [FALLBACK_BETA] and seen["fallbacks"] == "default"
    assert seen["output_config"] == {"effort": "low"}
    assert seen["system"] == [{"type": "text", "text": SYSTEM_PROMPT}, {"type": "text", "text": "FARM FACTS ..."}]
    assert "thinking" not in seen and "temperature" not in seen


def test_claude_refusal_raises_so_the_helper_can_answer():
    assistant = ClaudeAssistant(fake_client(["Sorr"], "refusal", {}), "claude-opus-5-5", "low")

    async def run():
        return [t async for t in assistant.stream("f", [{"role": "user", "content": "hi"}])]

    with pytest.raises(AssistantRefusedError):
        asyncio.run(run())


# --- endpoints ------------------------------------------------------------------------------


def parse_sse(text):
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def test_status_reports_the_built_in_helper_without_a_key():
    client = TestClient(create_app())
    assert client.get("/api/v1/assistant/status").json() == {"engine": "offline", "label": "Built-in helper", "languages": ["en", "bn"]}


def test_chat_endpoint_streams_server_sent_events():
    client = TestClient(create_app())
    res = client.post("/api/v1/assistant/chat", json={"farm_id": "bogura-potato", "lang": "bn", "messages": [{"role": "user", "content": "হ্যালো"}]})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(res.text)
    assert events[0] == ("meta", {"engine": "offline", "lang": "bn"})
    assert "ফার্মশিল্ড" in "".join(e[1]["text"] for e in events if e[0] == "delta")
    assert events[-1][0] == "done"


def test_chat_endpoint_uses_claude_when_available():
    app = create_app()
    app.dependency_overrides[get_claude] = lambda: FakeClaude(["Hello ", "farmer"])
    res = TestClient(app).post("/api/v1/assistant/chat", json={"farm_id": "barind-wheat", "messages": [{"role": "user", "content": "hi"}]})
    events = parse_sse(res.text)
    assert events[0][1]["engine"] == "claude"
    assert "".join(e[1]["text"] for e in events if e[0] == "delta") == "Hello farmer"


def test_chat_endpoint_validates_farm_and_last_message():
    client = TestClient(create_app())
    msg = [{"role": "user", "content": "hi"}]
    assert client.post("/api/v1/assistant/chat", json={"farm_id": "nowhere", "messages": msg}).status_code == 404
    assert client.post("/api/v1/assistant/chat", json={"farm_id": "barind-wheat", "messages": [{"role": "assistant", "content": "hi"}]}).status_code == 422
    assert client.post("/api/v1/assistant/chat", json={"farm_id": "barind-wheat", "lang": "fr", "messages": msg}).status_code == 422
    assert client.post("/api/v1/assistant/chat", json={"farm_id": "barind-wheat", "messages": []}).status_code == 422


# --- live smoke test (opt-in: pytest -m live) ---------------------------------------------


@pytest.mark.live
def test_live_claude_answers_in_bengali_from_the_facts():
    """Needs ANTHROPIC_API_KEY in backend/.env (tests blank the env var, so read the file)."""
    from pathlib import Path

    from dotenv import dotenv_values

    from app.assistant.claude import claude_client

    key = dotenv_values(Path(__file__).parents[1] / ".env").get("ANTHROPIC_API_KEY")
    if not key:
        pytest.skip("ANTHROPIC_API_KEY not set in backend/.env")
    assistant = ClaudeAssistant(claude_client(key), "claude-opus-5-5", "low")
    facts = fact_sheet(with_water_action(dash("barind-wheat"), "irrigate"), TODAY, "bn")

    async def run():
        return "".join([t async for t in assistant.stream(facts, [{"role": "user", "content": "আজ কি সেচ দেব?"}])])

    answer = asyncio.run(run())
    assert offline.BENGALI.search(answer)
    assert "NDVI" not in answer and "/100" not in answer
