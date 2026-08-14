from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from triage_shared import DISCLAIMER, URGENCY_LEVELS

from .core.config import settings
from .core.db import init_db
from .ml.prediction_service import PredictionService
from .routers import sessions as sessions_router
from .routers import triage as triage_router
from .ws.manager import manager
from .ws.routes import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.predictor = PredictionService.from_dir(settings.ml_artifact_dir)
    await manager.start_redis(settings.redis_url)
    yield
    await manager.stop()


app = FastAPI(
    title="MedScope 3D API",
    version="0.0.0",
    description="Triage API (research/education prototype). Not medical advice.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(triage_router.router)
app.include_router(sessions_router.router)
app.include_router(ws_router)


@app.get("/healthz", tags=["ops"])
def healthz() -> dict:
    return {"status": "ok", "engine_version": settings.engine_version}


@app.get("/readyz", tags=["ops"])
def readyz() -> dict:
    predictor = getattr(app.state, "predictor", None)
    return {
        "status": "ready",
        "model": predictor.health() if predictor else {"ready": False},
    }


@app.get("/api/v1/meta", tags=["meta"])
def meta() -> dict:
    predictor = getattr(app.state, "predictor", None)
    return {
        "engine_version": settings.engine_version,
        "urgency_levels": URGENCY_LEVELS,
        "disclaimer": DISCLAIMER,
        "model": predictor.health() if predictor else {"ready": False},
    }
