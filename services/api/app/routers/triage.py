from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_predictor
from ..triage import TriageInput, TriageResult, assess

router = APIRouter(prefix="/api/v1/triage", tags=["triage"])


@router.post("/assess", response_model=TriageResult)
def assess_endpoint(payload: TriageInput, predictor=Depends(get_predictor)) -> TriageResult:
    """Stateless one-shot triage assessment.

    Runs the deterministic safety pipeline (completeness gate -> vitals red flags
    -> symptom red flags -> ML baseline -> conservative fallback, escalate-only
    merge). Returns urgency guidance only — never a diagnosis.
    """
    return assess(payload, predictor)
