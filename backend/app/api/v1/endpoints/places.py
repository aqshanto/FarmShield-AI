from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.data.crops import CROPS, WORLD_CROPS
from app.data.places import DISTRICTS, DIVISIONS
from app.i18n import Lang
from app.pipeline import get_pipeline
from app.pipeline.service import PipelineService
from app.risk.region import in_bangladesh
from app.services.custom_farms import describe_point
from app.services.geocode import reverse_geocode, search_places

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
    # In Bangladesh: district and division. Elsewhere: nearest named place and country.
    inside: bool
    district: PlaceOut | None = None
    division: PlaceOut | None = None
    km_to_district_town: float | None = None
    place: str | None = None
    country: str | None = None
    # False for open water; None when the place service couldn't be reached.
    land: bool | None = None


class FoundPlaceOut(BaseModel):
    name: str
    detail: str
    country: str | None
    lat: float
    lon: float


def _place(p) -> PlaceOut:
    return PlaceOut(name=p.name, name_bn=p.name_bn, lat=p.lat, lon=p.lon, division=p.division)


@router.get("/places", response_model=PlacesOut)
def places() -> PlacesOut:
    """Bangladesh's 8 divisions and 64 districts (headquarters towns), in English and Bengali."""
    return PlacesOut(divisions=[_place(d) for d in DIVISIONS.values()], districts=[_place(d) for d in DISTRICTS])


@router.get("/crops", response_model=list[CropOut])
def crops(region: Literal["bangladesh", "world"] = "bangladesh") -> list[CropOut]:
    """Crops a farmer can choose: Bangladesh's (with seasons) or the plain list for elsewhere."""
    return [CropOut(**c.__dict__) for c in (WORLD_CROPS if region == "world" else CROPS)]


@router.get("/locate", response_model=LocateOut)
async def locate(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    lang: Lang = Query(default="en"),
    pipeline: PipelineService = Depends(get_pipeline),
) -> LocateOut:
    """In Bangladesh: which district town is it near? Elsewhere: which place and country?"""
    if in_bangladesh(lat, lon):
        district, division, km = describe_point(lat, lon)
        return LocateOut(lat=lat, lon=lon, inside=True, district=_place(district), division=_place(division), km_to_district_town=round(km, 1), land=True)
    found = await reverse_geocode(pipeline, lat, lon, lang)
    if found is None:
        return LocateOut(lat=lat, lon=lon, inside=False)
    return LocateOut(lat=lat, lon=lon, inside=False, place=found.name, country=found.country, land=found.land)


@router.get("/places/search", response_model=list[FoundPlaceOut])
async def search(
    q: str = Query(min_length=2, max_length=100),
    lang: Lang = Query(default="en"),
    pipeline: PipelineService = Depends(get_pipeline),
) -> list[FoundPlaceOut]:
    """Find a village, town or region anywhere (OpenStreetMap)."""
    found = await search_places(pipeline, q, lang)
    if found is None:
        raise HTTPException(status_code=503, detail="The place search isn't answering right now. Tap your field on the map instead.")
    return [FoundPlaceOut(**p.__dict__) for p in found]
