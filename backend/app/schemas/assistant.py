from typing import Literal

from pydantic import BaseModel, Field

Lang = Literal["en", "bn"]
AssistantEngine = Literal["claude", "offline"]

MAX_TURNS = 20
MAX_CHARS = 1500


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    farm_id: str
    lang: Lang = "en"
    # Whole conversation so far, oldest first; the last message is the farmer's question.
    messages: list[ChatMessage] = Field(min_length=1, max_length=60)


class AssistantStatus(BaseModel):
    engine: AssistantEngine
    # Shown in the UI: "Claude" when the AI model is on, else the built-in helper.
    label: str
    languages: list[Lang] = ["en", "bn"]
