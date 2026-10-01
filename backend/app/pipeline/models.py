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
    "precipitation_forecast",
    "temperature_max_forecast",
    "temperature_min_forecast",
    "weather_code",
    "elevation",
    "precipitation_normal",
    "temperature_mean",
    "humidity",
    "temperature_mean_forecast",
    "humidity_forecast",
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
    # Serve this many days past today (forecasts).
    lookahead_days: int = 0
    # Not a time series (terrain, monthly normals): served whatever the date window.
    static: bool = False


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
        Variable("precipitation_forecast", "Rain forecast", "mm/day", "Forecast daily rain (last 3 days + next 7)", ("open_meteo",), lookahead_days=7),
        Variable("temperature_max_forecast", "High forecast", "°C", "Forecast daily high", ("open_meteo",), lookahead_days=7),
        Variable("temperature_min_forecast", "Low forecast", "°C", "Forecast daily low", ("open_meteo",), lookahead_days=7),
        Variable("weather_code", "Weather", "WMO", "Forecast weather type (WMO code)", ("open_meteo",), lookahead_days=7),
        Variable("elevation", "Elevation", "m", "Height above sea level (SRTM)", ("srtm",), static=True),
        Variable("precipitation_normal", "Normal rainfall", "mm/day", "Average daily rain for each month", ("power_climatology",), static=True),
        Variable("temperature_mean", "Mean temperature", "°C", "Daily mean air temperature", ("nasa_power",)),
        Variable("humidity", "Humidity", "%", "Daily mean relative humidity", ("nasa_power",)),
        Variable("temperature_mean_forecast", "Mean temperature forecast", "°C", "Forecast daily mean temperature", ("open_meteo",), lookahead_days=7),
        Variable("humidity_forecast", "Humidity forecast", "%", "Forecast daily mean relative humidity", ("open_meteo",), lookahead_days=7),
    ]
}
