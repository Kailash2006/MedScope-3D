"""Shared session helpers: apply a patch, recompute urgency, persist assessment.

Used by both the REST PATCH endpoint and the WebSocket so autosave + live
recompute behave identically.
"""
from __future__ import annotations

from sqlalchemy.orm import Session as OrmSession

from .models.db import Assessment, Session
from .schemas.session import SessionUpdate, session_to_input
from .triage import assess
from .triage.models import TriageResult


def apply_patch(row: Session, patch: SessionUpdate) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "age" in data:
        row.age = data["age"]
    if "sex" in data:
        row.sex = data["sex"]
    if "regions" in data:
        row.regions = data["regions"]
    if "risk_factors" in data:
        row.risk_factors = data["risk_factors"]
    if "symptoms" in data and data["symptoms"] is not None:
        row.symptoms = [s.model_dump(mode="json") for s in patch.symptoms]
    if "vitals" in data and data["vitals"] is not None:
        row.vitals = patch.vitals.model_dump()


def recompute_and_store(db: OrmSession, row: Session, predictor=None) -> TriageResult:
    inp = session_to_input(row)
    result = assess(inp, predictor)
    db.add(Assessment(
        session_id=row.id,
        urgency=result.urgency,
        confidence=result.confidence,
        decision_path=result.decision_path,
        reasons=[r.model_dump() for r in result.reasons],
        model_version=result.model_version,
        engine_version=result.engine_version,
        input_snapshot=inp.model_dump(mode="json"),
    ))
    db.flush()
    return result


def latest_assessment(db: OrmSession, session_id: str) -> Assessment | None:
    return (
        db.query(Assessment)
        .filter(Assessment.session_id == session_id)
        .order_by(Assessment.created_at.desc())
        .first()
    )
