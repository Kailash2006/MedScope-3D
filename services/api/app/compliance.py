"""Data-rights + retention helpers (Phase 6).

Data in this prototype is anonymous and session-scoped, so "your data" == the
session the client holds. Export returns a full JSON bundle; delete hard-purges
the session and its cascaded assessments (recording a no-PHI audit row first);
the retention purge removes sessions past their expires_at.
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session as OrmSession
from triage_shared import DISCLAIMER

from .audit import logger as audit
from .models.db import Assessment, AuditLog, Session

_PRIVACY_NOTE = (
    "Research/education prototype. Not HIPAA-compliant. Data is anonymous and "
    "session-scoped. You can export or delete it at any time. Do not enter real, "
    "identifiable health information."
)


def export_bundle(db: OrmSession, session: Session) -> dict:
    """Full machine-readable export of everything tied to a session."""
    assessments = (
        db.query(Assessment).filter(Assessment.session_id == session.id)
        .order_by(Assessment.created_at.asc()).all()
    )
    audits = (
        db.query(AuditLog).filter(AuditLog.target_id == session.id)
        .order_by(AuditLog.created_at.asc()).all()
    )
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "disclaimer": DISCLAIMER,
        "privacy_note": _PRIVACY_NOTE,
        "session": {
            "id": session.id, "status": session.status, "age": session.age, "sex": session.sex,
            "regions": session.regions, "symptoms": session.symptoms,
            "risk_factors": session.risk_factors, "vitals": session.vitals,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
            "expires_at": session.expires_at.isoformat(),
        },
        "assessments": [
            {
                "urgency": a.urgency, "confidence": a.confidence, "decision_path": a.decision_path,
                "reasons": a.reasons, "model_version": a.model_version,
                "engine_version": a.engine_version, "input_snapshot": a.input_snapshot,
                "created_at": a.created_at.isoformat(),
            }
            for a in assessments
        ],
        "audit_logs": [
            {"action": x.action, "created_at": x.created_at.isoformat(), "ip_hash": x.ip_hash}
            for x in audits
        ],
    }


def delete_session(db: OrmSession, session: Session, ip: str | None = None) -> int:
    """Hard-delete a session + cascaded assessments. Returns assessments removed.

    An audit row is written FIRST (target_id is a plain string, so it survives the
    delete) and records no PHI — only that a deletion happened.
    """
    n = db.query(Assessment).filter(Assessment.session_id == session.id).count()
    audit.record(db, "session.delete", "session", session.id, ip=ip,
                 meta={"assessments_deleted": n})
    db.delete(session)  # ORM cascade removes assessments
    db.commit()
    return n


def purge_expired(db: OrmSession, now: datetime | None = None) -> int:
    """Delete sessions past their retention window. Returns sessions purged."""
    now = now or datetime.now(UTC)
    expired = db.query(Session).filter(Session.expires_at < now).all()
    for s in expired:
        audit.record(db, "session.purge", "session", s.id, meta={"reason": "retention_expired"})
        db.delete(s)
    db.commit()
    return len(expired)


def privacy_note() -> str:
    return _PRIVACY_NOTE
