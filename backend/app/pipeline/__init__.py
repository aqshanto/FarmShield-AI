"""NASA data pipeline: SMAP, GPM, MODIS and VIIRS (plus NASA POWER as a no-login stand-in)."""

from functools import lru_cache

from app.core.config import get_settings
from app.data.sample.farms import SAMPLE_FARMS
from app.pipeline.models import Location
from app.pipeline.service import PipelineService
from app.pipeline.sources.opendap import ImergSource, SmapSource
from app.pipeline.sources.ornl import ModisNdviSource, ViirsNormalSource
from app.pipeline.sources.power import PowerSource
from app.pipeline.store import ObservationStore


def build_sources(earthdata_token: str | None):
    return [PowerSource(), ModisNdviSource(), ViirsNormalSource(), ImergSource(earthdata_token), SmapSource(earthdata_token)]


@lru_cache
def get_pipeline() -> PipelineService:
    settings = get_settings()
    token = settings.earthdata_token or None
    return PipelineService(ObservationStore(settings.pipeline_db_path), build_sources(token))


def farm_locations() -> list[Location]:
    return [Location(f["farm"]["id"], f["farm"]["lat"], f["farm"]["lon"]) for f in SAMPLE_FARMS.values()]
