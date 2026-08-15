from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session as OrmSession

from ..core.config import settings
from ..core.db import get_db
from ..deps import get_predictor
from ..models.db import Assessment, AuditLog, Session
from ..security import require_admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_RED_FLAG_PATHS = ("VITALS_RED_FLAG", "SYMPTOM_RED_FLAG")
_FALLBACK_PATHS = ("FALLBACK_LOW_CONF", "FALLBACK_MODEL_ERROR", "FALLBACK_MISSING")


def _distribution(db: OrmSession, column) -> dict[str, int]:
    rows = db.query(column, func.count()).group_by(column).all()
    return {str(k): int(v) for k, v in rows}


@router.get("/dashboard")
def dashboard(request: Request, db: OrmSession = Depends(get_db), predictor=Depends(get_predictor)) -> dict:
    total_sessions = db.query(func.count(Session.id)).scalar() or 0
    total_assessments = db.query(func.count(Assessment.id)).scalar() or 0
    by_path = _distribution(db, Assessment.decision_path)
    by_urgency = _distribution(db, Assessment.urgency)
    avg_conf = db.query(func.avg(Assessment.confidence)).scalar()

    redflags = sum(by_path.get(p, 0) for p in _RED_FLAG_PATHS)
    fallbacks = sum(by_path.get(p, 0) for p in _FALLBACK_PATHS)

    return {
        "totals": {"sessions": int(total_sessions), "assessments": int(total_assessments)},
        "decision_path_distribution": by_path,
        "urgency_distribution": by_urgency,
        "safety": {
            "red_flag_count": redflags,
            "fallback_count": fallbacks,
            "fallback_rate": round(fallbacks / total_assessments, 4) if total_assessments else 0.0,
            "red_flag_rate": round(redflags / total_assessments, 4) if total_assessments else 0.0,
            "avg_confidence": round(float(avg_conf), 4) if avg_conf is not None else None,
        },
        "model": predictor.health() if predictor else {"ready": False},
        "engine_version": settings.engine_version,
    }


@router.get("/audit")
def audit_log(
    db: OrmSession = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000),
) -> list[dict]:
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id, "action": r.action, "target_type": r.target_type,
            "target_id": r.target_id, "ip_hash": r.ip_hash, "meta": r.meta,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/models")
def models(predictor=Depends(get_predictor)) -> dict:
    return {
        "active": predictor.health() if predictor else {"ready": False},
        "engine_version": settings.engine_version,
        "confidence_threshold": settings.ml_confidence_threshold,
    }
