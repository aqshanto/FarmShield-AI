import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints.data import start_background_refresh
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.pipeline import get_pipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s %(message)s")
# httpx logs every request at INFO; keep the console readable.
logging.getLogger("httpx2").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.pipeline_auto_refresh:
        # Background, cache-aware: restarts within a source's TTL download nothing.
        start_background_refresh(get_pipeline(), settings.pipeline_days)
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="NASA-powered climate intelligence for farmers.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
