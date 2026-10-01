import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool

from app.assistant.claude import ClaudeAssistant, claude_client
from app.assistant.service import chat_events
from app.core.config import Settings, get_settings
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.schemas.assistant import AssistantStatus, ChatRequest
from app.services.dashboard import FarmNotFoundError, build_dashboard

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
    try:
        # Building the dashboard reads SQLite; keep it off the event loop.
        dashboard = await run_in_threadpool(build_dashboard, body.farm_id, settings.data_mode, None, pipeline)
    except FarmNotFoundError:
        raise HTTPException(status_code=404, detail=f"Farm '{body.farm_id}' not found") from None
    today = (datetime.now(UTC) + timedelta(hours=6)).date()  # Bangladesh calendar day

    async def sse() -> AsyncIterator[str]:
        async for event, data in chat_events(dashboard, body.messages, body.lang, today, claude):
            yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
