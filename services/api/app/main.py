from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from triage_shared import DISCLAIMER, URGENCY_LEVELS

from .compliance import purge_expired
from .core.config import settings
from .core.db import SessionLocal, init_db
from .ml.prediction_service import PredictionService
from .routers import admin as admin_router
from .routers import auth as auth_router
from .routers import nlp as nlp_router
from .routers import sessions as sessions_router
from .routers import settings as settings_router
from .routers import triage as triage_router
from .ws.manager import manager
from .ws.routes import router as ws_router


def _run_purge() -> int:
    db = SessionLocal()
    try:
        return purge_expired(db)
    finally:
        db.close()


async def _purge_loop() -> None:
    interval = settings.purge_interval_seconds
    if interval <= 0:
        return
    while True:
        await asyncio.sleep(interval)
        with contextlib.suppress(Exception):
            await asyncio.to_thread(_run_purge)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.predictor = PredictionService.from_dir(settings.ml_artifact_dir)
    await manager.start_redis(settings.redis_url)
    purge_task = asyncio.create_task(_purge_loop())
    yield
    purge_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await purge_task
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
app.include_router(auth_router.router)
app.include_router(nlp_router.router)
app.include_router(sessions_router.router)
app.include_router(admin_router.router)
app.include_router(settings_router.router)
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
