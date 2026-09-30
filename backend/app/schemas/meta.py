from typing import Literal

from pydantic import BaseModel

RiskModule = Literal["flood_risk", "water_stress", "crop_health"]


class HealthStatus(BaseModel):
    status: Literal["ok"]
    app: str
    version: str
    environment: str
    data_mode: str


class DataSource(BaseModel):
    id: str
    name: str
    full_name: str
    measures: str
    used_for: list[RiskModule]


class Region(BaseModel):
    name: str
    lat: float
    lon: float
    zoom: int
