from pydantic import BaseModel


class RotationCrop(BaseModel):
    id: str
    name: str
    months: list[int]  # 1–12, in the order the crop grows


class RotationStrategy(BaseModel):
    id: str
    name: str  # "Mustard → Mungbean → Aman rice"
    existing: bool
    verdict: str  # Your rotation now · Best match for your priorities · Better / Similar / Weaker than now
    overall: int  # 0–100 for the farmer's priorities
    scores: dict[str, int]  # soil, water, climate, pests, income, food (0–100, higher is better)
    irrigation_mm: int  # a year, on top of the usual rain
    bare_months: list[int]
    crops: list[RotationCrop]
    why: list[str]
    evidence: list[str]
    benefits: list[str]
    gaps: list[str]
    risks: list[str]


class RotationOption(BaseModel):
    id: str
    name: str


class ClimateMonth(BaseModel):
    month: int
    rain_mm: float  # a normal month's total
    tmax: float  # normal daily high, °C
    tmin: float  # normal daily low, °C


class RotationPlan(BaseModel):
    farm_id: str
    crop: str
    in_bangladesh: bool
    priorities: list[str]
    irrigation: bool
    existing_id: str
    existing_options: list[RotationOption]  # rotations the farmer may be growing now
    strategies: list[RotationStrategy]  # the current rotation first, then up to three ideas
    climate: list[ClimateMonth]
    wet_months: list[int]
    field_notes: list[str]
    sources: list[str]
