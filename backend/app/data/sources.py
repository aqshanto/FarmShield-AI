"""Catalog of the NASA Earth observation sources FarmShield AI builds on.

Phase 4 attaches a data provider (sample or live) to each source id.
"""

from app.schemas.meta import DataSource

NASA_SOURCES: tuple[DataSource, ...] = (
    DataSource(
        id="smap",
        name="SMAP",
        full_name="Soil Moisture Active Passive",
        measures="Soil moisture",
        used_for=["flood_risk", "water_stress"],
    ),
    DataSource(
        id="gpm",
        name="GPM",
        full_name="Global Precipitation Measurement",
        measures="Rainfall",
        used_for=["flood_risk"],
    ),
    DataSource(
        id="modis",
        name="MODIS",
        full_name="Moderate Resolution Imaging Spectroradiometer",
        measures="Vegetation (NDVI) and land surface",
        used_for=["crop_health", "water_stress"],
    ),
    DataSource(
        id="viirs",
        name="VIIRS",
        full_name="Visible Infrared Imaging Radiometer Suite",
        measures="Environmental and land observation",
        used_for=["crop_health"],
    ),
)
