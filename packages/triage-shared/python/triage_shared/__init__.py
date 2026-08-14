"""Shared triage contracts for Python services.

Loads the SAME canonical JSON as the TypeScript package
(../../schema/*.json), so UrgencyLevel, reasons, and the age-banded
red-flag table never drift between languages. Parity is CI-enforced.
"""
from .urgency import (
    UrgencyLevel,
    URGENCY_LEVELS,
    INSUFFICIENT_INFO,
    rank_of,
    label_of,
    advice_of,
    escalate,
)
from .reasons import DecisionPath, ReasonType, Reason, DISCLAIMER
from .tables import red_flag_table, feature_contract, load_schema

__all__ = [
    "UrgencyLevel",
    "URGENCY_LEVELS",
    "INSUFFICIENT_INFO",
    "rank_of",
    "label_of",
    "advice_of",
    "escalate",
    "DecisionPath",
    "ReasonType",
    "Reason",
    "DISCLAIMER",
    "red_flag_table",
    "feature_contract",
    "load_schema",
]
