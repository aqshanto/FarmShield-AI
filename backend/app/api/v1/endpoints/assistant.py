import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.assistant.claude import ClaudeAssistant, claude_client
from app.assistant.service import chat_events
from app.core.config import Settings, get_settings
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.schemas.assistant import AssistantStatus, ChatRequest
from app.risk.region import local_today
from app.services.farm_access import load_dashboard

router = APIRouter(prefix="/assistant", tags=["assistant"])


def get_claude(settings: Settings = Depends(get_settings)) -> ClaudeAssistant | None:
    if not settings.anthropic_api_key:
        return None
    return ClaudeAssistant(claude_client(settings.anthropic_api_key), settings.assistant_model, settings.assistant_effort)


@router.get("/status", response_model=AssistantStatus)
def status(claude: ClaudeAssistant | None = Depends(get_claude)) -> AssistantStatus:
    if claude is None:
        return AssistantStatus(engine="offline", label="Built-in helper")
    return AssistantStatus(engine="claude", label="Claude AI")


@router.post("/chat")
async def chat(
    body: ChatRequest,
    settings: Settings = Depends(get_settings),
    pipeline: PipelineService = Depends(get_pipeline),
    claude: ClaudeAssistant | None = Depends(get_claude),
) -> StreamingResponse:
    """Streams the reply as server-sent events: meta, delta*, (replace), done."""
    if body.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be the farmer's question.")
    dashboard = await load_dashboard(body.farm_id, settings.data_mode, pipeline, body.farm_name, body.lang)
    today = local_today(datetime.now(UTC), dashboard.farm.lon)  # the farm's own calendar day

    async def sse() -> AsyncIterator[str]:
        async for event, data in chat_events(dashboard, body.messages, body.lang, today, claude):
            yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
