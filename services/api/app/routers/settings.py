from __future__ import annotations

from fastapi import APIRouter
from triage_shared import DISCLAIMER

from ..compliance import privacy_note
from ..core.config import settings

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


@router.get("/retention")
def retention() -> dict:
    return {
        "default_retention_days": settings.default_retention_days,
        "audit_retention_days": settings.audit_retention_days,
        "purge_interval_seconds": settings.purge_interval_seconds,
    }


@router.get("/privacy")
def privacy() -> dict:
    return {"privacy_note": privacy_note(), "disclaimer": DISCLAIMER}
