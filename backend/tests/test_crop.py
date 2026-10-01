from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.pipeline import get_pipeline
from app.risk.crop import CropInputs, assess_crop, crop_profile, crop_trend, disease_days, score_factors
from app.risk.flood import DailyRain
from app.risk.water import Reading
from app.services.dashboard import build_dashboard

TODAY = date(2026, 10, 1)


def day(offset: int) -> date:
    return TODAY + timedelta(days=offset)


def inputs(
    crop="Boro rice",
    tmax: float = 31,
    tmean: float = 27,
    humidity: float | None = 80,
    ndvi: dict[int, float] | None = None,
    normal: float = 0.7,
    water: int | None = 20,
    flood: int | None = 20,
    rain_mm: float = 2,
) -> CropInputs:
    offsets = range(-40, 8)
    return CropInputs(
        crop=crop,
        rain=[DailyRain(day(o), rain_mm, "nasa_power", o > 0) for o in offsets],
        tmax={day(o): Reading(tmax, "nasa_power") for o in offsets},
        tmean={day(o): tmean for o in offsets},
        humidity={day(o): humidity for o in offsets} if humidity is not None else {},
        ndvi={day(o): Reading(v, "modis") for o, v in (ndvi or {}).items()},
        ndvi_normal={day(o): normal for o in range(-40, 1, 8)},
        water_score=water,
        flood_score=flood,
    )


@pytest.mark.parametrize(("crop", "name", "limit", "disease"), [
    ("Boro rice", "rice", 35, "rice blast"),
    ("Wheat", "wheat", 32, "wheat blast"),
    ("Potato", "potato", 29, "late blight"),
    ("Jute", "jute", 37, "stem rot"),
    ("Aman rice", "rice", 35, "rice blast"),
    ("Maize", "maize", 35, "northern leaf blight"),
    ("Mustard", "mustard", 32, "Alternaria blight"),
    ("Lentil", "lentil", 30, "Stemphylium blight"),
    ("Tomato", "tomato", 32, "late blight"),
    ("Sugarcane", "crop", 35, "fungal disease"),  # unknown crops get the generic profile
])
def test_crop_profiles(crop, name, limit, disease):
    p = crop_profile(crop)
    assert (p.name, p.heat_limit_c, p.disease) == (name, limit, disease)


def test_healthy_green_field_in_kind_weather_is_safe_with_high_confidence():
    a = assess_crop(inputs(ndvi={-20: 0.72, -4: 0.74}), TODAY)
    assert a.level == "safe" and a.status == "Healthy"
    assert a.confidence == "high"
    assert a.explanation.startswith("Your plants look as they should")
    assert a.advice[0][1] == "Keep up regular field checks"


def test_yellowing_field_with_falling_greenness_is_flagged():
    a = assess_crop(inputs(ndvi={-20: 0.7, -4: 0.42}, normal=0.72), TODAY)
    by = {f.id: f for f in a.factors}
    assert by["greenness"].score == 100  # 0.30 below normal
    assert by["trend"].score == 100  # fell 0.28 in 16 days
    assert a.level in ("warning", "danger")  # severe visible decline is never diluted below warning
    assert a.score >= 55
    assert a.advice[0][1] == "Walk your field and check for yellow or wilting plants" and a.advice[0][0] == "high"


def test_heat_uses_the_crop_s_own_limit():
    potato = score_factors(inputs(crop="Potato", tmax=31), TODAY)[1]
    rice = score_factors(inputs(crop="Boro rice", tmax=31), TODAY)[1]
    assert next(f for f in potato if f.id == "heat").score == 100  # 31 °C ≥ 29 °C every day
    assert next(f for f in rice if f.id == "heat").score == 0  # below 35 °C


def test_disease_weather_depends_on_crop_temperature_band_and_humidity():
    humid_warm = inputs(crop="Boro rice", tmean=27, humidity=93)
    assert disease_days(humid_warm, TODAY, crop_profile("Boro rice")) == 8
    # Same weather is too warm for potato late blight (10–25 °C).
    assert disease_days(inputs(crop="Potato", tmean=27, humidity=93), TODAY, crop_profile("Potato")) == 0
    # Without humidity data, rainy days stand in.
    assert disease_days(inputs(humidity=None, rain_mm=8), TODAY, crop_profile("rice")) == 8
    a = assess_crop(humid_warm, TODAY)
    assert any(item[1] == "Check leaves for blast spots" for item in a.advice)


def test_clouds_hide_the_field_and_the_engine_says_so():
    a = assess_crop(inputs(ndvi={-100: 0.7}), TODAY)
    assert "greenness" not in {f.id for f in a.factors}
    assert a.confidence == "medium"
    assert "Clouds have hidden your field from satellites since" in a.explanation
    assert a.cloud_gap_days == 100
    assert any(item[1] == "Walk the field this week" for item in a.advice)


def test_water_on_the_field_is_not_scored_as_a_sick_crop():
    a = assess_crop(inputs(ndvi={-10: -0.14}), TODAY)
    assert "greenness" not in {f.id for f in a.factors}
    assert "showed water or bare soil" in a.explanation
    assert a.level == "safe"


def test_water_and_flood_scores_feed_through():
    by = {f.id: f for f in score_factors(inputs(water=80, flood=75), TODAY)[1]}
    assert by["water"].score == 80
    assert by["flood"].score == 100  # (75 − 25) / 50


def test_trend_follows_the_water_trend():
    trend = crop_trend(inputs(), TODAY, water_trend=[0] * 7 + [100] * 7, flood_trend=[0] * 14)
    assert len(trend) == 14 and trend[-1] > trend[0]


# --- live dashboard / API -------------------------------------------------------------------------


def test_live_dashboard_crop_module_has_indicators():
    from tests.test_water import pipeline

    # The shared test pipeline holds data for the Barind (wheat) farm.
    dash = build_dashboard("barind-wheat", "live", now=datetime(2026, 10, 1, 0, tzinfo=UTC), pipeline=pipeline())
    crop = next(m for m in dash.modules if m.id == "crop_health")
    assert crop.data_source == "live" and crop.indicators is not None
    assert crop.indicators.crop == "wheat" and crop.indicators.heat_limit_c == 32
    assert crop.status in ("Healthy", "Mostly healthy", "Under stress", "At risk")
    assert any(r.id.startswith("crop-") for r in dash.recommendations)


def test_crop_endpoint():
    from tests.test_water import pipeline

    app = create_app()
    app.dependency_overrides[get_pipeline] = pipeline
    client = TestClient(app)
    body = client.get("/api/v1/farms/barind-wheat/crop").json()
    assert body["indicators"]["crop"] == "wheat" and body["indicators"]["disease"] == "wheat blast"
    assert len(body["trend"]) == 14 and body["advice"]
    assert client.get("/api/v1/farms/nowhere/crop").status_code == 404
