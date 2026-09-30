"""Synthetic risk surfaces over Bangladesh for DATA_MODE=sample.

Each layer is a sum of smooth "hotspots" placed where that risk really concentrates:
flash floods in the north-east haor wetlands and along the Jamuna, drought in the
north-west Barind tract, crop stress on the saline south-west coast. Small deterministic
noise keeps it from looking artificial. Near each demo farm the surface is pulled
towards that farm's own score, so the map and the dashboard always agree.

Phase 4 replaces this with gridded SMAP / GPM / MODIS values on the same cell layout.
"""

import hashlib
import math
from collections.abc import Callable

from app.schemas.meta import RiskModule

CELL_SIZE_DEG = 0.2
# [min_lon, min_lat, max_lon, max_lat], a little wider than the country.
BBOX = (88.0, 20.6, 92.8, 26.8)

Hotspot = tuple[float, float, float, float]  # (lat, lon, sigma_deg, strength)

HOTSPOTS: dict[RiskModule, list[Hotspot]] = {
    "flood_risk": [
        (24.95, 91.2, 0.55, 68),  # Sylhet haor basin: flash floods
        (25.3, 89.7, 0.32, 40),  # Jamuna / Brahmaputra floodplain (north)
        (24.4, 89.75, 0.32, 38),  # Jamuna floodplain (south)
        (22.2, 90.4, 0.7, 34),  # coastal surge & tidal flooding
    ],
    "water_stress": [
        (24.65, 88.5, 0.65, 76),  # Barind tract: drought
        (25.7, 89.1, 0.55, 36),  # Rangpur, drier north
        (23.3, 88.9, 0.45, 18),  # Kushtia / Jashore
    ],
    "crop_health": [
        (22.4, 89.4, 0.6, 50),  # saline south-west coast
        (24.6, 88.5, 0.5, 38),  # heat-stressed Barind crops
        (24.9, 91.2, 0.4, 14),  # humid north-east: disease pressure
    ],
}

BASELINE: dict[RiskModule, float] = {"flood_risk": 8, "water_stress": 10, "crop_health": 10}


def _gauss(lat: float, lon: float, clat: float, clon: float, sigma: float) -> float:
    return math.exp(-((lat - clat) ** 2 + (lon - clon) ** 2) / (2 * sigma**2))


def _noise(lat: float, lon: float, layer: str, amplitude: float = 5) -> float:
    digest = hashlib.sha256(f"{lat:.2f},{lon:.2f},{layer}".encode()).digest()
    return (digest[0] / 255 * 2 - 1) * amplitude


def cell_centres() -> list[tuple[float, float]]:
    min_lon, min_lat, max_lon, max_lat = BBOX
    cols = round((max_lon - min_lon) / CELL_SIZE_DEG)
    rows = round((max_lat - min_lat) / CELL_SIZE_DEG)
    return [
        (round(min_lat + (r + 0.5) * CELL_SIZE_DEG, 3), round(min_lon + (c + 0.5) * CELL_SIZE_DEG, 3))
        for r in range(rows)
        for c in range(cols)
    ]


def risk_surface(
    layer: RiskModule, anchors: list[tuple[float, float, int]], anchor_sigma: float = 0.25
) -> Callable[[float, float], int]:
    """Returns score(lat, lon) for a layer. `anchors` are (lat, lon, score) the surface must honour."""

    def score(lat: float, lon: float) -> int:
        value = BASELINE[layer] + sum(s * _gauss(lat, lon, clat, clon, sig) for clat, clon, sig, s in HOTSPOTS[layer])
        value += _noise(lat, lon, layer)
        for alat, alon, anchor_score in anchors:
            w = _gauss(lat, lon, alat, alon, anchor_sigma)
            value = value * (1 - w) + anchor_score * w
        return round(min(100.0, max(0.0, value)))

    return score
