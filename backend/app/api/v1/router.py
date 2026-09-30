"""Aggregates all v1 endpoint routers. New feature modules register here."""

from fastapi import APIRouter

from app.api.v1.endpoints import farms, map, meta

api_router = APIRouter()
api_router.include_router(meta.router)
api_router.include_router(farms.router)
api_router.include_router(map.router)
