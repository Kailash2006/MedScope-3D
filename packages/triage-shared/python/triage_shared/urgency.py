"""UrgencyLevel enum + escalate-only merge, sourced from schema/urgency.json."""
from __future__ import annotations

from enum import Enum

from .tables import load_schema

_URGENCY = load_schema("urgency.json")
_RANK = {lvl["value"]: lvl["rank"] for lvl in _URGENCY["levels"]}
_LABEL = {lvl["value"]: lvl["label"] for lvl in _URGENCY["levels"]}
_ADVICE = {lvl["value"]: lvl["advice"] for lvl in _URGENCY["levels"]}


class UrgencyLevel(str, Enum):
    EMERGENCY = "EMERGENCY"
    URGENT_TODAY = "URGENT_TODAY"
    DOCTOR_SOON = "DOCTOR_SOON"
    ROUTINE = "ROUTINE"
    SELF_CARE = "SELF_CARE"
    INSUFFICIENT_INFO = "INSUFFICIENT_INFO"


# Canonical order straight from the JSON (single source of truth).
URGENCY_LEVELS: list[str] = [lvl["value"] for lvl in _URGENCY["levels"]]
INSUFFICIENT_INFO = UrgencyLevel(_URGENCY["sentinel"])


def rank_of(level: UrgencyLevel | str) -> int:
    return _RANK.get(str(getattr(level, "value", level)), 0)


def label_of(level: UrgencyLevel | str) -> str:
    key = str(getattr(level, "value", level))
    return _LABEL.get(key, key)


def advice_of(level: UrgencyLevel | str) -> str:
    return _ADVICE.get(str(getattr(level, "value", level)), "")


def escalate(a: UrgencyLevel, b: UrgencyLevel) -> UrgencyLevel:
    """Return the MORE urgent level. Safety invariant: never downgrades.

    INSUFFICIENT_INFO (rank 0) never wins against a real level.
    """
    return a if rank_of(a) >= rank_of(b) else b
