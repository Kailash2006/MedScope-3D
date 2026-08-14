from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field


class Vitals(BaseModel):
    """All optional — a missing vital is treated as non-reassuring, never normal."""

    hr: float | None = None       # heart rate, bpm
    sbp: float | None = None      # systolic BP, mmHg
    dbp: float | None = None      # diastolic BP, mmHg
    spo2: float | None = None     # oxygen saturation, %
    temp_c: float | None = None   # temperature, Celsius
    rr: float | None = None       # respiratory rate, /min

    def present(self) -> bool:
        return any(v is not None for v in self.model_dump().values())


class SymptomEntry(BaseModel):
    code: str
    severity: int = Field(default=0, ge=0, le=10)
    duration_hours: float | None = Field(default=None, ge=0)


class TriageInput(BaseModel):
    regions: list[str] = Field(default_factory=list)
    symptoms: list[SymptomEntry] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    vitals: Vitals = Field(default_factory=Vitals)
    age: int | None = Field(default=None, ge=0, le=130)
    sex: Literal["M", "F", "O"] | None = None


class ReasonOut(BaseModel):
    type: str
    rule: str | None = None
    message: str


class TriageResult(BaseModel):
    urgency: str
    confidence: float
    reasons: list[ReasonOut]
    decision_path: str
    advice: str
    model_version: str
    engine_version: str
    disclaimer: str
    age_band: str | None = None
    assessed_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
