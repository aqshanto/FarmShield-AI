import os

# Tests never touch the real cache file or start network refreshes. Set before the app
# (and its cached settings) are imported.
os.environ.setdefault("PIPELINE_DB_PATH", ":memory:")
os.environ.setdefault("PIPELINE_AUTO_REFRESH", "false")
os.environ.setdefault("EARTHDATA_TOKEN", "")
os.environ.setdefault("DATA_MODE", "sample")


def pytest_configure(config):
    config.addinivalue_line("markers", "live: hits real NASA services (run with: pytest -m live)")


def pytest_collection_modifyitems(config, items):
    if "live" in (config.getoption("-m") or ""):
        return
    import pytest

    skip = pytest.mark.skip(reason="live NASA test; run with -m live")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip)
