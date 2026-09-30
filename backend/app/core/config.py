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

    # "sample" serves bundled demo data; "live" calls NASA services (Phase 4).
    data_mode: Literal["sample", "live"] = "sample"

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
    anthropic_api_key: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
