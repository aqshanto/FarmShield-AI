"""Chooses Claude or the built-in helper and streams the reply as events."""

import asyncio
import logging
import re
from collections.abc import AsyncIterator
from datetime import date

import anthropic

from app.assistant import offline
from app.assistant.claude import AssistantRefusedError, ClaudeAssistant
from app.assistant.facts import fact_sheet
from app.schemas.assistant import MAX_CHARS, MAX_TURNS, ChatMessage
from app.schemas.dashboard import Dashboard

log = logging.getLogger(__name__)

Event = tuple[str, dict]


def claude_history(messages: list[ChatMessage]) -> list[dict]:
    """Recent turns only, clipped, starting with the farmer (the UI's greeting is dropped)."""
    recent = messages[-MAX_TURNS:]
    while recent and recent[0].role != "user":
        recent = recent[1:]
    return [{"role": m.role, "content": m.content[:MAX_CHARS]} for m in recent]


async def _typed(text: str, delay: float) -> AsyncIterator[str]:
    """Stream built-in replies word by word so both engines feel the same."""
    for chunk in re.findall(r"\S+\s*|\s+", text):
        yield chunk
        if delay:
            await asyncio.sleep(delay)


async def chat_events(
    dashboard: Dashboard,
    messages: list[ChatMessage],
    lang: str,
    today: date,
    claude: ClaudeAssistant | None,
    word_delay: float = 0.025,
) -> AsyncIterator[Event]:
    question = messages[-1].content
    reply_lang = offline.detect_lang(question, lang)

    if claude is not None:
        yield "meta", {"engine": "claude", "lang": reply_lang}
        try:
            async for text in claude.stream(fact_sheet(dashboard, today, lang), claude_history(messages)):
                yield "delta", {"text": text}
            yield "done", {"engine": "claude"}
            return
        except AssistantRefusedError:
            log.info("Assistant: Claude declined; answering with the built-in helper")
        except anthropic.APIError as exc:
            # Bad key, no network, rate limit, overload: the farmer still gets an answer.
            log.warning("Assistant: Claude unavailable (%s); answering with the built-in helper", type(exc).__name__)
        yield "replace", {"text": offline.reply(dashboard, question, today, lang), "engine": "offline"}
        yield "done", {"engine": "offline"}
        return

    yield "meta", {"engine": "offline", "lang": reply_lang}
    async for chunk in _typed(offline.reply(dashboard, question, today, lang), word_delay):
        yield "delta", {"text": chunk}
    yield "done", {"engine": "offline"}
