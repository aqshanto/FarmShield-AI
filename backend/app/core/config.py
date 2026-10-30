"""Application settings, loaded from environment variables or backend/.env."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "FarmShield AI"
    app_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"
    api_v1_prefix: str = "/api/v1"

    # Comma-separated list of allowed frontend origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex for extra origins, e.g. Vercel preview URLs:
    # https://farmshield-[a-z0-9-]+\.vercel\.app
    cors_origin_regex: str | None = None

    # "live": risk engines run on NASA data where available (demo data fills the rest).
    # "sample": the bundled demo scenario only, e.g. for an offline presentation.
    data_mode: Literal["sample", "live"] = "live"

    # Default focus region: Bangladesh.
    default_region_name: str = "Bangladesh"
    default_region_lat: float = 23.685
    default_region_lon: float = 90.3563
    default_region_zoom: int = 7

    # NASA data pipeline.
    pipeline_db_path: str = "data/farmshield.db"
    # Refresh NASA data in the background when the API starts (respects cache freshness).
    pipeline_auto_refresh: bool = True
    pipeline_days: int = 60

    # Optional secrets.
    # Earthdata Login token: unlocks mission-native GPM IMERG and SMAP data.
    earthdata_token: str | None = None
    # Anthropic API key: turns on the Claude-powered farmer assistant. Without it the
    # assistant still answers from the risk engines with built-in bilingual replies.
    anthropic_api_key: str | None = None
    # Per-visitor request limits (see app/core/security.py). Off only in tests.
    rate_limit_enabled: bool = True
    # Optional secret for maintainers: send it as the X-Admin-Token header to force a full NASA
    # re-download. Without it anyone may still ask for a normal (cache-aware) refresh.
    admin_token: str | None = None
    # Real SMS through Twilio (optional; without these the SMS card only previews and logs).
    # Texts go only to the numbers in SMS_TEST_NUMBERS (comma-separated, +8801…), never to a
    # number typed on the website, so visitors can't send SMS through the server.
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from: str | None = None  # a Twilio number (+1…) or a Messaging Service SID (MG…)
    sms_test_numbers: str = ""
    sms_daily_limit: int = 10  # real sends per day, to protect the gateway credit
    assistant_model: str = "claude-opus-5-5"
    # Chat replies are short and grounded in facts we supply, so low effort keeps them fast.
    assistant_effort: Literal["low", "medium", "high"] = "low"

    @property
    def sms_numbers(self) -> list[str]:
        return [n.strip() for n in self.sms_test_numbers.split(",") if n.strip()]

    @property
    def real_sms_ready(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token and self.twilio_from and self.sms_numbers)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
