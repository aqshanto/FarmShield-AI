"""Which tuning applies where: Bangladesh (the engines' home calibration) or anywhere else."""

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

OUTLINE = json.loads((Path(__file__).resolve().parent.parent / "data" / "bangladesh.geo.json").read_text())


def _in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_bangladesh(lat: float, lon: float) -> bool:
    geometry = OUTLINE["geometry"]
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    return any(_in_ring(lon, lat, outer) and not any(_in_ring(lon, lat, hole) for hole in holes) for outer, *holes in polygons)


def local_today(now: datetime, lon: float) -> date:
    """The calendar day at that longitude (solar time is close enough for daily weather;
    UTC+6 in Bangladesh)."""
    return (now.astimezone(UTC) + timedelta(hours=round(lon / 15))).date()
