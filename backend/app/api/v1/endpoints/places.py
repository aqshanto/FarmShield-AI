from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.data.crops import CROPS
from app.data.places import DISTRICTS, DIVISIONS
from app.risk.grid import in_bangladesh
from app.services.custom_farms import describe_point

router = APIRouter(tags=["places"])


class PlaceOut(BaseModel):
    name: str
    name_bn: str
    lat: float
    lon: float
    division: str = ""


class PlacesOut(BaseModel):
    divisions: list[PlaceOut]
    districts: list[PlaceOut]


class CropOut(BaseModel):
    id: str
    name: str
    name_bn: str
    season: str
    season_bn: str
    scene: str


class LocateOut(BaseModel):
    lat: float
    lon: float
    inside: bool
    district: PlaceOut | None = None
    division: PlaceOut | None = None
    km_to_district_town: float | None = None


def _place(p) -> PlaceOut:
    return PlaceOut(name=p.name, name_bn=p.name_bn, lat=p.lat, lon=p.lon, division=p.division)


@router.get("/places", response_model=PlacesOut)
def places() -> PlacesOut:
    """Bangladesh's 8 divisions and 64 districts (headquarters towns), in English and Bengali."""
    return PlacesOut(divisions=[_place(d) for d in DIVISIONS.values()], districts=[_place(d) for d in DISTRICTS])


@router.get("/crops", response_model=list[CropOut])
def crops() -> list[CropOut]:
    """Crops a farmer can choose for their own farm."""
    return [CropOut(**c.__dict__) for c in CROPS]


@router.get("/locate", response_model=LocateOut)
def locate(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180)) -> LocateOut:
    """Is this point in Bangladesh, and which district town is it near?"""
    if not in_bangladesh(lat, lon):
        return LocateOut(lat=lat, lon=lon, inside=False)
    district, division, km = describe_point(lat, lon)
    return LocateOut(lat=lat, lon=lon, inside=True, district=_place(district), division=_place(division), km_to_district_town=round(km, 1))
