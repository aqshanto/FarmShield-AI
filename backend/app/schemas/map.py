from datetime import datetime

from pydantic import BaseModel

from app.schemas.dashboard import OverallCondition, RiskLevel
from app.schemas.meta import RiskModule


class GridCell(BaseModel):
    # Cell centre.
    lat: float
    lon: float
    # 0-100 risk score per layer.
    flood_risk: int
    water_stress: int
    crop_health: int


class MapLayer(BaseModel):
    id: RiskModule
    title: str
    description: str
    sources: list[str]
    # True when computed by a risk engine from live NASA data (else demo surface).
    live: bool = False


class ModuleLevel(BaseModel):
    score: int
    level: RiskLevel


class MapFarm(BaseModel):
    id: str
    name: str
    district: str
    crop: str
    lat: float
    lon: float
    overall: OverallCondition
    modules: dict[RiskModule, ModuleLevel]


class MapOverview(BaseModel):
    generated_at: datetime
    data_mode: str
    cell_size_deg: float
    # [min_lon, min_lat, max_lon, max_lat]
    bbox: tuple[float, float, float, float]
    layers: list[MapLayer]
    cells: list[GridCell]
    farms: list[MapFarm]
