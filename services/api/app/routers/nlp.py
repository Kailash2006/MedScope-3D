from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..nlp.extract import extract
from ..ratelimit import rate_limit

router = APIRouter(prefix="/api/v1/nlp", tags=["nlp"], dependencies=[Depends(rate_limit)])


class ExtractIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class SymptomOut(BaseModel):
    code: str
    severity: int
    duration_hours: float | None = None


class ExtractOut(BaseModel):
    symptoms: list[SymptomOut]
    regions: list[str]
    risk_factors: list[str]
    vitals: dict[str, float]
    detected: dict


@router.post("/extract", response_model=ExtractOut)
def extract_symptoms(payload: ExtractIn) -> ExtractOut:
    """Free text -> structured triage inputs (on-device style, no external calls).

    Deterministic lexicon + fuzzy matching; the triage engine still governs urgency.
    """
    return ExtractOut(**extract(payload.text))
