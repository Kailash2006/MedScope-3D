"""Completeness gate, conservative fallback, and age-extreme modifier.

Phase 1 has no ML, so every non-red-flag case resolves through the conservative
fallback (a safe floor), optionally escalated one level for age extremes.
"""
from __future__ import annotations

from triage_shared import UrgencyLevel, red_flag_table

from .models import TriageInput

_TABLE = red_flag_table()
_MODIFIERS = _TABLE["modifiers"]
_EXTREME_BANDS = set(_MODIFIERS["escalate_one_level_bands"])

# rank -> level, for one-level modifier bumps (from the shared urgency ranks).
_RANK_TO_LEVEL = {
    5: UrgencyLevel.EMERGENCY,
    4: UrgencyLevel.URGENT_TODAY,
    3: UrgencyLevel.DOCTOR_SOON,
    2: UrgencyLevel.ROUTINE,
    1: UrgencyLevel.SELF_CARE,
}
_LEVEL_TO_RANK = {v: k for k, v in _RANK_TO_LEVEL.items()}

# A modifier may lift a borderline case at most to URGENT_TODAY — it must never
# fabricate an EMERGENCY (only red-flag rules can do that).
_MODIFIER_CAP_RANK = 4


def has_assessable_input(inp: TriageInput) -> bool:
    """The completeness gate: is there anything at all to reason about?"""
    return bool(inp.symptoms) or bool(inp.regions) or inp.vitals.present()


def conservative_fallback(inp: TriageInput) -> UrgencyLevel:
    """Safe floor when no red flag fired and no model is available.

    Errs toward more care: high-severity symptoms -> URGENT_TODAY, any symptom ->
    DOCTOR_SOON, otherwise SELF_CARE.
    """
    max_sev = max((s.severity for s in inp.symptoms), default=0)
    if max_sev >= 8:
        return UrgencyLevel.URGENT_TODAY
    if inp.symptoms:
        return UrgencyLevel.DOCTOR_SOON
    return UrgencyLevel.SELF_CARE


def apply_age_modifier(
    level: UrgencyLevel, inp: TriageInput, band: str | None, had_vitals_red_flag: bool
) -> tuple[UrgencyLevel, bool]:
    """Escalate one level for age extremes on borderline presentations.

    Borderline := a symptom of severity 5-6, OR fever present without a vitals
    red flag. Returns (level, applied).
    """
    if band not in _EXTREME_BANDS:
        return level, False
    if level == UrgencyLevel.EMERGENCY:
        return level, False

    borderline_severity = any(5 <= s.severity <= 6 for s in inp.symptoms)
    fever = inp.vitals.temp_c is not None and inp.vitals.temp_c >= 38.0
    if not (borderline_severity or (fever and not had_vitals_red_flag)):
        return level, False

    new_rank = min(_LEVEL_TO_RANK[level] + 1, _MODIFIER_CAP_RANK)
    return _RANK_TO_LEVEL[new_rank], new_rank != _LEVEL_TO_RANK[level]
