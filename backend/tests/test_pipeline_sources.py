import asyncio
import json
from datetime import date
from urllib.parse import parse_qs, urlparse

import httpx2
import pytest

from app.pipeline.grids import M09_COLS, M09_ROWS, ease2_m09_index, ease2_xy, imerg_index
from app.pipeline.http import get
from app.pipeline.models import Location
from app.pipeline.sources.base import ApprovalRequiredError, SourceError, TokenRequiredError
from app.pipeline.sources.opendap import ImergSource, SmapSource, pair_slice, parse_opendap_values
from app.pipeline.sources.ornl import ModisNdviSource, ViirsNormalSource, classify, fetch_band
from app.pipeline.sources.power import parse_power

FARM = Location("barind", 24.62, 88.56)


def run(coro):
    return asyncio.run(coro)


def client_for(handler) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(transport=httpx2.MockTransport(handler))


# --- NASA POWER ------------------------------------------------------------------------


def test_power_maps_parameters_and_drops_fill_values():
    payload = {
        "header": {"fill_value": -999.0},
        "properties": {
            "parameter": {
                "PRECTOTCORR": {"20260926": 6.65, "20260927": 1.14, "20260928": -999.0},
                "GWETTOP": {"20260927": 0.73},
                "IGNORED": {"20260927": 1},
            }
        },
    }
    obs = parse_power(payload, "nasa_power")
    assert {(o.variable, o.date.isoformat(), o.value) for o in obs} == {
        ("precipitation", "2026-09-26", 6.65),
        ("precipitation", "2026-09-27", 1.14),
        ("soil_wetness", "2026-09-27", 0.73),
    }
    assert all(o.source == "nasa_power" for o in obs)


def test_power_rejects_unexpected_payload():
    with pytest.raises(SourceError):
        parse_power({"messages": ["bad request"]}, "nasa_power")


# --- ORNL MODIS / VIIRS ---------------------------------------------------------------------


def test_quality_flags_are_read_per_product():
    assert classify("MOD13Q1", 7699, 0) == (0.7699, "good")
    assert classify("MOD13Q1", 7699, 1) == (0.7699, "marginal")
    assert classify("MOD13Q1", 1485, 3)[1] == "rejected"  # cloudy
    # VIIRS uses a 0–11 scale: 2 = acceptable, 6 = poor, 9 = cloud.
    assert classify("VNP13A1", 8870, 2)[1] == "good"
    assert classify("VNP13A1", 9225, 6)[1] == "marginal"
    assert classify("VNP13A1", 1583, 9)[1] == "rejected"
    assert classify("MOD13Q1", -3000, 0) is None  # fill


def _from_modis_date(value: str) -> date:
    return date.fromordinal(date(int(value[1:5]), 1, 1).toordinal() + int(value[5:]) - 1)


def ornl_handler(values: dict[tuple[str, str], dict[str, int]], calls: list):
    """Fake ORNL subset API that, like the real one, only returns dates inside the request window."""

    def handler(request: httpx2.Request) -> httpx2.Response:
        product = request.url.path.split("/")[-2]
        band = request.url.params["band"]
        start, end = request.url.params["startDate"], request.url.params["endDate"]
        calls.append((product, band, start, end))
        lo, hi = _from_modis_date(start), _from_modis_date(end)
        rows = [
            {"calendar_date": d, "data": [v], "band": band}
            for d, v in values.get((product, band), {}).items()
            if lo <= date.fromisoformat(d) <= hi
        ]
        return httpx2.Response(200, json={"subset": rows})

    return handler


def test_fetch_band_respects_the_ten_dates_per_request_limit():
    calls: list = []

    async def go():
        async with client_for(ornl_handler({}, calls)) as client:
            await fetch_band(client, "VNP13A1", "500_m_16_days_NDVI", FARM, date(2016, 7, 16), date(2016, 10, 17))
            await fetch_band(client, "MOD13Q1", "250m_16_days_NDVI", FARM, date(2026, 6, 1), date(2026, 10, 1))

    run(go())
    viirs = [c for c in calls if c[0] == "VNP13A1"]
    modis = [c for c in calls if c[0] == "MOD13Q1"]
    assert len(viirs) == 2  # 93 days at an 8-day cadence needs two requests
    assert len(modis) == 1  # 122 days at a 16-day cadence fits in one


def test_modis_combines_terra_and_aqua_with_quality():
    values = {
        ("MOD13Q1", "250m_16_days_NDVI"): {"2026-06-02": 6980, "2026-06-18": 6661},
        ("MOD13Q1", "250m_16_days_pixel_reliability"): {"2026-06-02": 1, "2026-06-18": 3},
        ("MYD13Q1", "250m_16_days_NDVI"): {"2026-06-10": 7166},
        ("MYD13Q1", "250m_16_days_pixel_reliability"): {"2026-06-10": 0},
    }

    async def go():
        async with client_for(ornl_handler(values, [])) as client:
            return await ModisNdviSource().fetch(client, FARM, date(2026, 6, 1), date(2026, 10, 1))

    obs = run(go())
    assert [(o.date.isoformat(), o.value, o.quality) for o in obs] == [
        ("2026-06-02", 0.698, "marginal"),
        ("2026-06-10", 0.7166, "good"),
        ("2026-06-18", 0.6661, "rejected"),
    ]


def test_viirs_normal_is_a_robust_multi_year_median():
    values: dict = {("VNP13A1", "500_m_16_days_NDVI"): {}, ("VNP13A1", "500_m_16_days_pixel_reliability"): {}}
    for i, year in enumerate(range(2013, 2024)):
        values[("VNP13A1", "500_m_16_days_NDVI")][f"{year}-09-14"] = 8000 + i * 100  # 0.80 … 0.90
        values[("VNP13A1", "500_m_16_days_pixel_reliability")][f"{year}-09-14"] = 2
    # One cloudy year with a silly value must not count.
    values[("VNP13A1", "500_m_16_days_pixel_reliability")]["2019-09-14"] = 9

    async def go():
        async with client_for(ornl_handler(values, [])) as client:
            return await ViirsNormalSource().fetch(client, FARM, date(2026, 9, 10), date(2026, 9, 18))

    obs = run(go())
    assert [o.date.isoformat() for o in obs] == ["2026-09-10", "2026-09-18"]
    # Median of the 10 accepted years (2019 excluded): 0.80…0.90 without 0.86 → 0.845
    assert obs[-1].value == pytest.approx(0.845)
    assert all(o.variable == "ndvi_normal" for o in obs)


# --- grids ---------------------------------------------------------------------------------


def test_imerg_index():
    assert imerg_index(24.62, 88.56) == (2685, 1146)
    assert imerg_index(-89.99, -179.99) == (0, 0)
    assert imerg_index(90, 180) == (3599, 1799)


def test_ease2_projection_basics():
    x, y = ease2_xy(0, 0)
    assert x == pytest.approx(0) and y == pytest.approx(0)
    # Equator / prime meridian sits at the grid centre.
    row, col = ease2_m09_index(0.01, 0.01)
    assert (row, col) == (M09_ROWS // 2 - 1, M09_COLS // 2)
    # Grid is symmetric: mirrored points land in mirrored cells.
    r1, c1 = ease2_m09_index(24.62, 88.56)
    r2, c2 = ease2_m09_index(-24.62, -88.56)
    assert (r2, c2) == (M09_ROWS - 1 - r1, M09_COLS - 1 - c1)
    # North is up, east is right.
    assert ease2_m09_index(25.5, 88.56)[0] < r1 < ease2_m09_index(23.5, 88.56)[0]
    assert ease2_m09_index(24.62, 88.0)[1] < c1 < ease2_m09_index(24.62, 89.0)[1]


# --- OPeNDAP (GPM IMERG / SMAP) ------------------------------------------------------------


def test_parse_opendap_values_handles_dap4_csv_and_dap2_ascii():
    # Real SMAP response shape (captured live): one line per leading index, then values.
    smap = (
        "Dataset: SMAP_L3_SM_P_E_20260925_R19240_001.h5\n"
        "/Soil_Moisture_Retrieval_Data_AM/soil_moisture[0], 0.396448, 0.43795\n"
        "/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm[0], -9999, -9999\n"
    )
    assert parse_opendap_values(smap, ["soil_moisture", "soil_moisture_pm"]) == [[0.396448, 0.43795], [-9999.0, -9999.0]]
    dap2 = "Dataset {\n Float32 precipitation[time = 1];\n} x;\n---\nprecipitation[0], 3.5e-01, 1.2\n"
    assert parse_opendap_values(dap2, ["precipitation"]) == [[0.35, 1.2]]
    # Hyrax's empty single-cell answer parses as "no values", never as a bogus number.
    assert parse_opendap_values("/Soil_Moisture_Retrieval_Data_AM/soil_moisture[0], \n", ["soil_moisture"]) == [[]]
    assert parse_opendap_values("nothing here", ["precipitation"]) == [[]]


def test_pair_slice_requests_two_cells_and_tracks_ours():
    assert pair_slice(2876, 3856) == ("[2876:2877]", 0)
    assert pair_slice(3855, 3856) == ("[3854:3855]", 1)  # last column: take the right-hand cell


def test_mission_sources_need_a_token():
    async def go():
        async with client_for(lambda r: httpx2.Response(500)) as client:
            await ImergSource(None).fetch(client, FARM, date(2026, 9, 1), date(2026, 9, 2))

    with pytest.raises(TokenRequiredError):
        run(go())


def opendap_handler(values_by_day: dict[str, str], seen: list):
    def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.host == "cmr.earthdata.nasa.gov":
            entries = [
                {"time_start": f"{day}T00:00:00.000Z", "links": [{"href": f"https://opendap.earthdata.nasa.gov/collections/C1/granules/{day}.nc4"}]}
                for day in values_by_day
            ]
            return httpx2.Response(200, json={"feed": {"entry": entries}})
        seen.append(request)
        day = request.url.path.split("/")[-1].removesuffix(".nc4.dap.csv")
        return httpx2.Response(200, text=values_by_day[day])

    return handler


def test_imerg_subsets_one_cell_per_day_with_the_token():
    seen: list = []
    handler = opendap_handler(
        {"2026-09-28": "/precipitation[0], 14.5, 3.0\n", "2026-09-29": "/precipitation[0], -9999.9, 2.0\n"}, seen
    )

    async def go():
        async with client_for(handler) as client:
            return await ImergSource("secret-token").fetch(client, FARM, date(2026, 9, 28), date(2026, 9, 29))

    obs = run(go())
    # Our cell is the first of the pair; the neighbour (3.0 / 2.0) is ignored, fill is dropped.
    assert [(o.date.isoformat(), o.value, o.source) for o in obs] == [("2026-09-28", 14.5, "gpm_imerg")]
    assert all(r.headers["Authorization"] == "Bearer secret-token" for r in seen)
    assert parse_qs(urlparse(str(seen[0].url)).query)["dap4.ce"] == ["/precipitation[0][2685][1146:1147]"]


def test_smap_falls_back_to_the_evening_pass():
    seen: list = []
    body = "/Soil_Moisture_Retrieval_Data_AM/soil_moisture[0], -9999, 0.2\n/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm[0], 0.31, 0.4\n"

    async def go():
        async with client_for(opendap_handler({"2026-09-28": body}, seen)) as client:
            return await SmapSource("t").fetch(client, FARM, date(2026, 9, 28), date(2026, 9, 28))

    obs = run(go())
    assert [(o.variable, o.value, o.unit) for o in obs] == [("soil_moisture", 0.31, "m³/m³")]


# --- HTTP helper --------------------------------------------------------------------------


def test_get_retries_transient_errors():
    attempts = []

    def handler(request):
        attempts.append(1)
        return httpx2.Response(503) if len(attempts) < 3 else httpx2.Response(200, json={"ok": True})

    async def go():
        async with client_for(handler) as client:
            return await get(client, "https://example.test/x", backoff=0)

    assert run(go()).json() == {"ok": True}
    assert len(attempts) == 3


@pytest.mark.parametrize(
    ("response", "error"),
    [(httpx2.Response(401), TokenRequiredError), (httpx2.Response(403), SourceError), (httpx2.Response(404), SourceError)],
)
def test_get_maps_http_errors(response, error):
    async def go():
        async with client_for(lambda r: response) as client:
            await get(client, "https://example.test/x", backoff=0)

    with pytest.raises(error):
        run(go())


def test_get_explains_unaccepted_archive_terms():
    # Real GES DISC answer (captured live) when the app hasn't been approved.
    eula = httpx2.Response(
        403,
        json={"status_code": 403, "error_description": "EULA Acceptance Failure", "resolution_url": "https://urs.example/approve"},
    )
    # OPeNDAP relays that 403 as text without the link.
    relayed = httpx2.Response(403, text="Dataset: ERROR status, 403 message ... https://data.gesdisc.earthdata.nasa.gov/data/... returned an HTTP code of 403")

    async def go(response):
        async with client_for(lambda r: response) as client:
            await get(client, "https://example.test/x", backoff=0)

    with pytest.raises(ApprovalRequiredError) as direct:
        run(go(eula))
    assert direct.value.approve_url == "https://urs.example/approve"
    with pytest.raises(ApprovalRequiredError) as via_opendap:
        run(go(relayed))
    assert "urs.earthdata.nasa.gov/approve_app" in via_opendap.value.approve_url


def test_get_treats_login_redirect_as_missing_token():
    def handler(request):
        if request.url.path == "/data":
            return httpx2.Response(302, headers={"Location": "https://example.test/login/urs"})
        return httpx2.Response(200, text="<html>Earthdata Login</html>")

    async def go():
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler), follow_redirects=True) as client:
            await get(client, "https://example.test/data", backoff=0)

    with pytest.raises(TokenRequiredError):
        run(go())


# --- live smoke test (opt-in: pytest -m live) ---------------------------------------------


@pytest.mark.live
def test_live_nasa_power_and_modis():
    from app.pipeline.http import make_client
    from app.pipeline.sources.power import PowerSource

    async def go():
        async with make_client() as client:
            power = await PowerSource().fetch(client, FARM, date(2026, 9, 1), date(2026, 9, 10))
            modis = await ModisNdviSource().fetch(client, FARM, date(2026, 5, 1), date(2026, 9, 1))
            return power, modis

    power, modis = run(go())
    assert any(o.variable == "precipitation" for o in power)
    assert modis and all(-0.3 <= o.value <= 1 for o in modis)
    json.dumps([o.value for o in power])  # values are plain floats
