"""The day's SMS: its automatic log, and real sends to the maintainers' phones."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings
from app.i18n import Lang
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.schemas.sms import SmsLogEntry, SmsSendResult, SmsStatus
from app.services.sms_delivery import SmsUnavailableError, history, send_real_sms, sent_today

router = APIRouter(prefix="/sms", tags=["sms"])


@router.get("/status", response_model=SmsStatus)
def sms_status(settings: Settings = Depends(get_settings), pipeline: PipelineService = Depends(get_pipeline)) -> SmsStatus:
    return SmsStatus(
        real_sending=settings.real_sms_ready,
        phones=len(settings.sms_numbers) if settings.real_sms_ready else 0,
        sent_today=sent_today(pipeline),
        daily_limit=settings.sms_daily_limit,
    )


@router.get("/history/{farm_id}", response_model=list[SmsLogEntry])
def sms_history(
    farm_id: str,
    lang: Lang = Query(default="en"),
    limit: int = Query(default=7, ge=1, le=30),
    pipeline: PipelineService = Depends(get_pipeline),
) -> list[SmsLogEntry]:
    """Newest first. Daily rows are written after each NASA refresh, for the demo farms."""
    return [
        SmsLogEntry(
            day=r.day,
            channel=r.channel,
            status=r.status,
            # A real send keeps only the language it was sent in.
            text=(r.text_bn if lang == "bn" else r.text_en) or r.text_en or r.text_bn,
            detail=r.detail,
            created_at=r.created_at,
        )
        for r in history(pipeline, farm_id, limit)
    ]


@router.post("/send/{farm_id}", response_model=SmsSendResult)
async def sms_send(
    farm_id: str,
    lang: Lang = Query(default="bn", description="Farmers get Bengali"),
    settings: Settings = Depends(get_settings),
    pipeline: PipelineService = Depends(get_pipeline),
) -> SmsSendResult:
    """Texts today's SMS for this farm to the maintainers' own phones (SMS_TEST_NUMBERS)."""
    try:
        sent, failed = await send_real_sms(pipeline, settings, farm_id, lang)
    except SmsUnavailableError as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    if not sent:
        raise HTTPException(status_code=502, detail="The SMS gateway didn't accept the message. See the log below the phone.")
    message = f"Sent to {sent} phone{'s' if sent != 1 else ''}" + (f", {failed} failed" if failed else "") + "."
    return SmsSendResult(sent=sent, failed=failed, message=message)
