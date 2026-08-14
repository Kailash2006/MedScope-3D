"""Reason / decision-path contracts, sourced from schema/reasons.schema.json."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .tables import load_schema

_REASONS = load_schema("reasons.schema.json")


class DecisionPath(str, Enum):
    VITALS_RED_FLAG = "VITALS_RED_FLAG"
    SYMPTOM_RED_FLAG = "SYMPTOM_RED_FLAG"
    ML = "ML"
    FALLBACK_LOW_CONF = "FALLBACK_LOW_CONF"
    FALLBACK_MISSING = "FALLBACK_MISSING"
    FALLBACK_MODEL_ERROR = "FALLBACK_MODEL_ERROR"


class ReasonType(str, Enum):
    RED_FLAG = "RED_FLAG"
    ML = "ML"
    FALLBACK = "FALLBACK"
    INFO = "INFO"


@dataclass
class Reason:
    type: ReasonType
    message: str
    rule: str | None = None

    def to_dict(self) -> dict:
        return {"type": self.type.value, "rule": self.rule, "message": self.message}


# Canonical enum values for CI parity assertions.
DECISION_PATHS: list[str] = list(_REASONS["decision_path"]["enum"])
REASON_TYPES: list[str] = list(_REASONS["reason_type"]["enum"])

DISCLAIMER = (
    "Research/education prototype. Not a diagnosis. Not medical advice. "
    "Red-flag thresholds are simplified triage-education defaults, not validated "
    "clinical cut-offs."
)
