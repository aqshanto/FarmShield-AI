"""Delivering the day's SMS: an automatic daily log, and real sends through Twilio.

After each NASA refresh the server writes every demo farm's SMS for the day (or notes that
none was needed) into the SMS log, once per farm per day. That runs on its own, with no
gateway, and the dashboard shows the last days of it.

Real sending goes through Twilio's REST API when the keys are set, and only to the
maintainers' own numbers (SMS_TEST_NUMBERS): a visitor can't send a text to any number they
type. A daily cap protects the gateway credit. Phone numbers are never stored or returned.
"""

import logging
from datetime import timedelta

from app.core.config import Settings
from app.pipeline import farm_locations
from app.pipeline.service import PipelineService
from app.pipeline.store import SmsRecord
from app.risk.region import local_today
from app.services.farm_access import load_dashboard
from app.services.sms import sms_messages

log = logging.getLogger("farmshield.sms")
TWILIO_MESSAGES = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
# Twilio's own error messages can contain the phone number, so only the code is kept, in plain
# words for the usual set-up problems.
TWILIO_ERRORS = {
    21408: "sending to this country isn't enabled in Twilio (Messaging > Settings > Geo permissions)",
    21608: "a trial account can only text verified numbers",
    21211: "a phone number is not valid",
    21606: "the sender number can't send SMS",
    20003: "the Twilio keys are wrong",
}


class SmsUnavailableError(Exception):
    """Real sending isn't possible right now (not set up, daily cap reached, or nothing to send)."""


async def write_daily_sms(pipeline: PipelineService, data_mode: str) -> int:
    """Logs today's SMS for every demo farm that has no entry yet; returns how many were added."""
    added = 0
    for location in farm_locations():
        today = local_today(pipeline.now(), location.lon)
        if pipeline.store.sms_has_daily(location.id, today):
            continue
        try:
            en, bn = sms_messages(await load_dashboard(location.id, data_mode, pipeline))
        except Exception as error:  # one farm without data never stops the others
            log.warning("No daily SMS for %s: %s", location.id, getattr(error, "detail", None) or error)
            continue
        record = SmsRecord(location.id, today, "daily", "alert" if en.send else "quiet", en.text, bn.text, None, pipeline.now())
        added += pipeline.store.sms_record(record)
    return added


def sent_today(pipeline: PipelineService) -> int:
    return pipeline.store.sms_real_since(pipeline.now() - timedelta(days=1))


async def send_real_sms(pipeline: PipelineService, settings: Settings, farm_id: str, lang: str) -> tuple[int, int]:
    """Texts the farm's SMS for today to the maintainers' numbers; returns (sent, failed)."""
    if not settings.real_sms_ready:
        raise SmsUnavailableError("Real SMS isn't set up on this server yet.")
    numbers = settings.sms_numbers
    if sent_today(pipeline) + len(numbers) > settings.sms_daily_limit:
        raise SmsUnavailableError("Today's real SMS limit is reached. Please try again tomorrow.")

    dashboard = await load_dashboard(farm_id, settings.data_mode, pipeline)
    message = next(m for m in sms_messages(dashboard) if m.lang == lang)
    if not message.send:
        raise SmsUnavailableError("No SMS today for this field: nothing needs action.")

    sent = failed = 0
    errors: list[str] = []
    sender = settings.twilio_from or ""
    async with pipeline.client_factory() as client:
        for number in numbers:
            form = {"To": number, "Body": message.text}
            form["MessagingServiceSid" if sender.startswith("MG") else "From"] = sender
            try:
                response = await client.post(
                    TWILIO_MESSAGES.format(sid=settings.twilio_account_sid),
                    data=form,
                    auth=(settings.twilio_account_sid or "", settings.twilio_auth_token or ""),
                )
            except Exception as error:
                failed += 1
                errors.append(type(error).__name__)
                continue
            if response.status_code < 300:
                sent += 1
            else:
                failed += 1
                try:
                    code = int(response.json().get("code") or 0)
                except (ValueError, TypeError):
                    code = 0
                errors.append(TWILIO_ERRORS.get(code, f"Twilio error {code}" if code else f"HTTP {response.status_code}"))

    today = local_today(pipeline.now(), dashboard.farm.lon)
    detail = f"{sent} sent, {failed} failed" + (f": {errors[0]}" if errors else "")
    texts = (message.text, "") if lang == "en" else ("", message.text)
    pipeline.store.sms_record(SmsRecord(farm_id, today, "real", "sent" if sent else "failed", *texts, detail, pipeline.now(), sent))
    if failed:
        log.warning("Real SMS for %s: %s", farm_id, detail)
    return sent, failed


def history(pipeline: PipelineService, farm_id: str, limit: int = 7) -> list[SmsRecord]:
    return pipeline.store.sms_history(farm_id, limit)
