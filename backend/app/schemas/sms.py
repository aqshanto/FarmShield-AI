from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class SmsStatus(BaseModel):
    real_sending: bool  # Twilio keys and the maintainers' numbers are set
    phones: int  # how many numbers a real send goes to (the numbers themselves stay private)
    sent_today: int  # messages, one per phone
    daily_limit: int


class SmsLogEntry(BaseModel):
    day: date
    channel: Literal["daily", "real"]  # written automatically · sent through the gateway
    status: Literal["alert", "quiet", "sent", "failed"]
    text: str  # in the requested language; empty for quiet days
    detail: str | None = None
    created_at: datetime


class SmsSendResult(BaseModel):
    sent: int
    failed: int
    message: str
