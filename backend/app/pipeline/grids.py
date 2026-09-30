"""Point → grid index for the mission grids we subset over OPeNDAP."""

import math

# --- GPM IMERG: global 0.1° lat/lon grid, dims [time][lon][lat] ---------------------
IMERG_RES = 0.1
IMERG_NLON = 3600
IMERG_NLAT = 1800


def imerg_index(lat: float, lon: float) -> tuple[int, int]:
    """(lon_index, lat_index) of the IMERG cell containing the point."""
    ilon = min(IMERG_NLON - 1, max(0, math.floor((lon + 180) / IMERG_RES)))
    ilat = min(IMERG_NLAT - 1, max(0, math.floor((lat + 90) / IMERG_RES)))
    return ilon, ilat


# --- SMAP: EASE-Grid 2.0 global 9 km (EPSG:6933), 3856 cols × 1624 rows ---------------
# Lambert cylindrical equal-area on WGS84, standard parallel 30°.
A = 6378137.0
E = 0.0818191908426
PHI_S = math.radians(30.0)
K0 = math.cos(PHI_S) / math.sqrt(1 - (E * math.sin(PHI_S)) ** 2)
M09_CELL = 9008.055210146
M09_COLS = 3856
M09_ROWS = 1624
M09_X_MIN = -17367530.44516138
M09_Y_MAX = 7314540.830638585


def _q(phi: float) -> float:
    s = math.sin(phi)
    return (1 - E**2) * (s / (1 - (E * s) ** 2) - (1 / (2 * E)) * math.log((1 - E * s) / (1 + E * s)))


def ease2_xy(lat: float, lon: float) -> tuple[float, float]:
    """Forward EASE-Grid 2.0 projection in metres."""
    x = A * K0 * math.radians(lon)
    y = A * _q(math.radians(lat)) / (2 * K0)
    return x, y


def ease2_m09_index(lat: float, lon: float) -> tuple[int, int]:
    """(row, col) of the 9 km EASE-Grid 2.0 cell containing the point."""
    x, y = ease2_xy(lat, lon)
    col = min(M09_COLS - 1, max(0, math.floor((x - M09_X_MIN) / M09_CELL)))
    row = min(M09_ROWS - 1, max(0, math.floor((M09_Y_MAX - y) / M09_CELL)))
    return row, col
