"""Common shapes every data source is normalised into."""

from dataclasses import dataclass
from datetime import date
from typing import Literal

# good: passed quality checks · marginal: usable with care · rejected: kept for audit, never served
Quality = Literal["good", "marginal", "rejected"]

VariableId = Literal[
    "precipitation",
    "soil_moisture",
    "soil_wetness",
    "root_zone_wetness",
    "temperature_max",
    "ndvi",
    "ndvi_normal",
]


@dataclass(frozen=True)
class Location:
    id: str
    lat: float
    lon: float


@dataclass(frozen=True)
class Observation:
    source: str
    variable: VariableId
    date: date
    value: float
    unit: str
    quality: Quality = "good"


@dataclass(frozen=True)
class Variable:
    id: VariableId
    label: str
    unit: str
    description: str
    # Source ids in preference order; the first with data for a date wins.
    sources: tuple[str, ...]
    # Serve at least this many days (e.g. cloud-prone vegetation needs a longer look-back).
    lookback_days: int = 0


VARIABLES: dict[VariableId, Variable] = {
    v.id: v
    for v in [
        Variable("precipitation", "Rainfall", "mm/day", "Daily rainfall", ("gpm_imerg", "nasa_power")),
        Variable("soil_moisture", "Soil moisture", "m³/m³", "Water in the top 5 cm of soil (SMAP)", ("smap",)),
        Variable("soil_wetness", "Soil wetness", "0–1", "How wet the surface soil is, 0 = dry, 1 = saturated", ("nasa_power",)),
        Variable("root_zone_wetness", "Root-zone wetness", "0–1", "Water available to roots, 0 = dry, 1 = saturated", ("nasa_power",)),
        Variable("temperature_max", "Max temperature", "°C", "Daily maximum air temperature", ("nasa_power",)),
        Variable("ndvi", "Plant greenness (NDVI)", "0–1", "16-day vegetation greenness, cloud-filtered", ("modis",), lookback_days=120),
        Variable("ndvi_normal", "Normal greenness", "0–1", "Seasonal normal NDVI for this time of year, 2013–2023", ("viirs",), lookback_days=120),
    ]
}
