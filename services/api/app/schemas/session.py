from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..triage.models import SymptomEntry, TriageInput, TriageResult, Vitals


class SessionCreate(BaseModel):
    age: int | None = Field(default=None, ge=0, le=130)
    sex: Literal["M", "F", "O"] | None = None


class SessionUpdate(BaseModel):
    """Partial patch — only provided fields are applied (autosave-friendly)."""

    age: int | None = Field(default=None, ge=0, le=130)
    sex: Literal["M", "F", "O"] | None = None
    regions: list[str] | None = None
    symptoms: list[SymptomEntry] | None = None
    risk_factors: list[str] | None = None
    vitals: Vitals | None = None


class SessionOut(BaseModel):
    id: str
    status: str
    age: int | None
    sex: str | None
    regions: list[str]
    symptoms: list[SymptomEntry]
    risk_factors: list[str]
    vitals: Vitals
    created_at: str
    updated_at: str
    expires_at: str
    latest_assessment: TriageResult | None = None


def session_to_input(row) -> TriageInput:
    return TriageInput(
        age=row.age, sex=row.sex, regions=row.regions or [],
        symptoms=[SymptomEntry(**s) for s in (row.symptoms or [])],
        risk_factors=row.risk_factors or [],
        vitals=Vitals(**(row.vitals or {})),
    )
