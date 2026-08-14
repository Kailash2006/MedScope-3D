from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from triage_shared import DISCLAIMER, URGENCY_LEVELS

from .core.config import settings

app = FastAPI(
    title="MedScope 3D API",
    version="0.0.0",
    description="Triage API (research/education prototype). Not medical advice.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["ops"])
def healthz() -> dict:
    """Liveness probe."""
    return {"status": "ok", "engine_version": settings.engine_version}


@app.get("/readyz", tags=["ops"])
def readyz() -> dict:
    """Readiness probe. Phase 0: no external deps checked yet (added in Phase 3)."""
    return {"status": "ready"}


@app.get("/api/v1/meta", tags=["meta"])
def meta() -> dict:
    """Surfaces contract metadata so the frontend can render disclaimers + levels."""
    return {
        "engine_version": settings.engine_version,
        "urgency_levels": URGENCY_LEVELS,
        "disclaimer": DISCLAIMER,
    }
