from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient

from app.data.sample.farms import SAMPLE_FARMS
from app.main import create_app
from app.services.dashboard import build_dashboard
from app.services.risk import overall_score, overall_summary, score_to_level

client = TestClient(create_app())


# --- risk service -----------------------------------------------------------


@pytest.mark.parametrize(
    ("score", "level"),
    [(0, "safe"), (24, "safe"), (25, "watch"), (49, "watch"), (50, "warning"), (74, "warning"), (75, "danger"), (100, "danger"), (-5, "safe"), (130, "danger")],
)
def test_score_to_level_matches_frontend_thresholds(score, level):
    assert score_to_level(score) == level


def test_overall_score_is_dominated_by_worst_risk():
    assert overall_score([80, 10, 10]) == 82  # 80 + 0.25 * 10
    assert overall_score([40, 40, 40]) == 50  # 40 + 0.25 * 40
    assert overall_score([95, 90, 90]) == 100  # capped
    assert overall_score([30]) == 30
    assert overall_score([]) == 0
    # Several medium risks score worse than one.
    assert overall_score([40, 40, 40]) > overall_score([40, 0, 0])


def test_safe_modules_never_add_up_to_a_risk():
    # Real case (Barind, 1 Oct 2026): flood 22, water 24, crop 14 used to read "watch".
    assert score_to_level(overall_score([22, 24, 14])) == "safe"
    assert overall_score([24, 24, 24]) == 24


def test_compounding_lifts_a_real_risk_by_at_most_one_level():
    assert score_to_level(overall_score([45, 49, 49])) == "warning"  # watch -> warning
    assert overall_score([49, 49, 49]) == 61
    assert score_to_level(overall_score([74, 74, 74])) == "danger"  # warning -> danger


@pytest.mark.parametrize("scores", [[78, 12, 30], [6, 81, 55], [28, 18, 10], [74, 74, 0], [24, 24, 24]])
def test_overall_level_is_never_calmer_than_worst_module(scores):
    levels = ["safe", "watch", "warning", "danger"]
    assert levels.index(score_to_level(overall_score(scores))) >= levels.index(score_to_level(max(scores)))


def test_overall_summary_names_the_worst_module():
    assert overall_summary("danger", "flood_risk") == "Act today: flood risk is high."
    assert overall_summary("safe", "crop_health") == "Your farm is in good shape this week."


# --- dashboard service ------------------------------------------------------


def test_sample_farms_are_internally_consistent():
    for farm_id, sample in SAMPLE_FARMS.items():
        assert sample["farm"]["id"] == farm_id
        assert set(sample["modules"]) == {"flood_risk", "water_stress", "crop_health"}
        assert len(sample["forecast"]) == 7
        for module in sample["modules"].values():
            assert len(module["trend"]) == 14
            assert all(0 <= v <= 100 for v in module["trend"])
        module_ids = set(sample["modules"])
        assert all(rec[1] in module_ids for rec in sample["recommendations"])


def test_build_dashboard_derives_scores_levels_and_dates():
    now = datetime(2026, 4, 10, 6, 0, tzinfo=UTC)
    dash = build_dashboard("sunamganj-haor", data_mode="sample", now=now)

    flood = next(m for m in dash.modules if m.id == "flood_risk")
    assert flood.score == 78 and flood.level == "danger"
    assert flood.change_7d == 78 - 34

    assert dash.overall.level == score_to_level(dash.overall.score)
    assert "flood risk" in dash.overall.summary

    assert dash.forecast[0].date == date(2026, 4, 10)
    assert dash.forecast[-1].date == date(2026, 4, 16)
    assert dash.last_satellite_pass < dash.generated_at

    priorities = [r.priority for r in dash.recommendations]
    assert priorities == sorted(priorities, key={"high": 0, "medium": 1, "low": 2}.get)


def test_each_demo_farm_tells_a_different_story():
    worst = {}
    for farm_id in SAMPLE_FARMS:
        dash = build_dashboard(farm_id, data_mode="sample")
        worst[farm_id] = max(dash.modules, key=lambda m: m.score).id
    assert worst["sunamganj-haor"] == "flood_risk"
    assert worst["barind-wheat"] == "water_stress"
    assert build_dashboard("bogura-potato", data_mode="sample").overall.level == "safe"


# --- API --------------------------------------------------------------------


def test_list_farms():
    response = client.get("/api/v1/farms")
    assert response.status_code == 200
    ids = [farm["id"] for farm in response.json()]
    assert ids == ["sunamganj-haor", "barind-wheat", "bogura-potato"]


def test_get_dashboard():
    response = client.get("/api/v1/farms/barind-wheat/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["farm"]["district"] == "Rajshahi"
    assert body["data_mode"] == "sample"
    assert {m["id"] for m in body["modules"]} == {"flood_risk", "water_stress", "crop_health"}
    assert len(body["forecast"]) == 7
    assert body["recommendations"][0]["priority"] == "high"


def test_unknown_farm_returns_404():
    response = client.get("/api/v1/farms/nowhere/dashboard")
    assert response.status_code == 404
    assert "nowhere" in response.json()["detail"]
