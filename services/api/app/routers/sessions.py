from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session as OrmSession

from ..audit import logger as audit
from ..core.db import get_db
from ..deps import get_predictor
from ..models.db import Assessment, Session
from ..report.pdf import build_report
from ..schemas.session import SessionCreate, SessionOut, SessionUpdate
from ..session_service import apply_patch, latest_assessment, recompute_and_store
from ..triage.models import TriageResult, Vitals

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _to_out(row: Session, latest: Assessment | None) -> SessionOut:
    la = None
    if latest is not None:
        la = TriageResult(
            urgency=latest.urgency, confidence=latest.confidence, reasons=latest.reasons,
            decision_path=latest.decision_path, advice="", model_version=latest.model_version,
            engine_version=latest.engine_version, disclaimer="",
            assessed_at=latest.created_at.isoformat(),
        )
    return SessionOut(
        id=row.id, status=row.status, age=row.age, sex=row.sex,
        regions=row.regions or [], symptoms=row.symptoms or [],
        risk_factors=row.risk_factors or [], vitals=Vitals(**(row.vitals or {})),
        created_at=row.created_at.isoformat(), updated_at=row.updated_at.isoformat(),
        expires_at=row.expires_at.isoformat(), latest_assessment=la,
    )


def _get_or_404(db: OrmSession, session_id: str) -> Session:
    row = db.get(Session, session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="session not found")
    return row


@router.post("", response_model=SessionOut, status_code=201)
def create_session(payload: SessionCreate, request: Request, db: OrmSession = Depends(get_db)) -> SessionOut:
    row = Session(age=payload.age, sex=payload.sex)
    db.add(row)
    db.flush()
    audit.record(db, "session.create", "session", row.id, ip=_client_ip(request))
    db.commit()
    return _to_out(row, None)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: OrmSession = Depends(get_db)) -> SessionOut:
    row = _get_or_404(db, session_id)
    return _to_out(row, latest_assessment(db, session_id))


@router.patch("/{session_id}", response_model=TriageResult)
def update_session(session_id: str, patch: SessionUpdate, request: Request,
                   db: OrmSession = Depends(get_db), predictor=Depends(get_predictor)) -> TriageResult:
    row = _get_or_404(db, session_id)
    apply_patch(row, patch)
    result = recompute_and_store(db, row, predictor)
    audit.record(db, "session.update", "session", row.id, ip=_client_ip(request),
                 meta={"decision_path": result.decision_path, "urgency": result.urgency})
    db.commit()
    return result


@router.get("/{session_id}/history", response_model=list[TriageResult])
def session_history(session_id: str, db: OrmSession = Depends(get_db)) -> list[TriageResult]:
    _get_or_404(db, session_id)
    rows = (
        db.query(Assessment).filter(Assessment.session_id == session_id)
        .order_by(Assessment.created_at.asc()).all()
    )
    return [
        TriageResult(
            urgency=a.urgency, confidence=a.confidence, reasons=a.reasons,
            decision_path=a.decision_path, advice="", model_version=a.model_version,
            engine_version=a.engine_version, disclaimer="", assessed_at=a.created_at.isoformat(),
        )
        for a in rows
    ]


@router.get("/{session_id}/timeline")
def session_timeline(session_id: str, db: OrmSession = Depends(get_db)) -> list[dict]:
    """Per-assessment snapshots for vitals charts and the symptom timeline."""
    _get_or_404(db, session_id)
    rows = (
        db.query(Assessment).filter(Assessment.session_id == session_id)
        .order_by(Assessment.created_at.asc()).all()
    )
    points = []
    for a in rows:
        snap = a.input_snapshot or {}
        points.append({
            "at": a.created_at.isoformat(),
            "urgency": a.urgency,
            "decision_path": a.decision_path,
            "confidence": a.confidence,
            "vitals": snap.get("vitals", {}),
            "symptoms": snap.get("symptoms", []),
        })
    return points


@router.get("/{session_id}/report.pdf")
def session_report(session_id: str, request: Request, db: OrmSession = Depends(get_db)) -> Response:
    """Clinician-ready PDF (disclaimer + model/engine version always included)."""
    row = _get_or_404(db, session_id)
    assessments = (
        db.query(Assessment).filter(Assessment.session_id == session_id)
        .order_by(Assessment.created_at.asc()).all()
    )
    pdf_bytes = build_report(row, assessments)
    audit.record(db, "session.report_export", "session", session_id, ip=_client_ip(request))
    db.commit()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="medscope-report-{session_id[:8]}.pdf"'},
    )
