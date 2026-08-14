"""Triage engine orchestration (Phase 1: rules -> conservative fallback).

The single entry point `assess()` runs the deterministic safety pipeline and
returns a fully-populated TriageResult, including a decision_path on every call.
"""
from __future__ import annotations

from triage_shared import (
    DISCLAIMER,
    DecisionPath,
    ReasonType,
    UrgencyLevel,
    advice_of,
    escalate,
    rank_of,
)

from ..core.config import settings
from .agebands import resolve_band
from .fallback import (
    apply_age_modifier,
    conservative_fallback,
    has_assessable_input,
)
from .models import ReasonOut, TriageInput, TriageResult
from .rules import evaluate_symptoms, evaluate_vitals

# Phase 1: no model artifact yet. Every non-red-flag case is a conservative
# fallback flagged as model-unavailable so the contract is stable for Phase 2.
MODEL_VERSION = "none"

_CONF_RED_FLAG = 0.99
_CONF_FALLBACK = 0.5
_CONF_INSUFFICIENT = 0.0


def assess(inp: TriageInput) -> TriageResult:
    band = resolve_band(inp.age)

    # 1. Completeness gate.
    if not has_assessable_input(inp):
        return _result(
            UrgencyLevel.INSUFFICIENT_INFO,
            _CONF_INSUFFICIENT,
            [ReasonOut(type=ReasonType.FALLBACK.value, rule=None,
                       message="No symptoms, regions, or vitals provided.")],
            DecisionPath.FALLBACK_MISSING,
            band,
        )

    # 2 + 3. Red-flag rules (vitals then symptoms).
    vitals_fires = evaluate_vitals(inp, band)
    symptom_fires = evaluate_symptoms(inp, band)
    all_fires = vitals_fires + symptom_fires

    red_flag_level = None
    for f in all_fires:
        red_flag_level = f.urgency if red_flag_level is None else escalate(red_flag_level, f.urgency)

    # 4 + 5. ML absent -> conservative fallback, then age-extreme modifier.
    fallback_level = conservative_fallback(inp)
    fallback_level, modifier_applied = apply_age_modifier(
        fallback_level, inp, band, had_vitals_red_flag=bool(vitals_fires)
    )

    # 6. Escalate-only merge: red flags dominate; fallback is the floor.
    baseline = fallback_level
    final = baseline if red_flag_level is None else escalate(red_flag_level, baseline)

    reasons: list[ReasonOut] = [
        ReasonOut(type=ReasonType.RED_FLAG.value, rule=f.rule_id, message=f.message)
        for f in all_fires
    ]

    # Decision path reflects what produced the FINAL (winning) urgency.
    if red_flag_level is not None and rank_of(final) == rank_of(red_flag_level):
        # A red flag set (or tied) the final level. Prefer vitals over symptom.
        won_via_vitals = any(rank_of(f.urgency) == rank_of(final) for f in vitals_fires)
        decision_path = DecisionPath.VITALS_RED_FLAG if won_via_vitals else DecisionPath.SYMPTOM_RED_FLAG
        confidence = _CONF_RED_FLAG
    else:
        decision_path = DecisionPath.FALLBACK_MODEL_ERROR
        confidence = _CONF_FALLBACK
        reasons.append(ReasonOut(
            type=ReasonType.FALLBACK.value, rule=None,
            message="No red flag; ML model not available (Phase 1) — conservative fallback applied.",
        ))
        if modifier_applied:
            reasons.append(ReasonOut(
                type=ReasonType.INFO.value, rule="modifiers.age_extreme",
                message=f"Escalated one level for age band '{band}' on a borderline presentation.",
            ))

    return _result(final, confidence, reasons, decision_path, band)


def _result(urgency, confidence, reasons, decision_path, band) -> TriageResult:
    return TriageResult(
        urgency=urgency.value if isinstance(urgency, UrgencyLevel) else urgency,
        confidence=confidence,
        reasons=reasons,
        decision_path=decision_path.value,
        advice=advice_of(urgency),
        model_version=MODEL_VERSION,
        engine_version=settings.engine_version,
        disclaimer=DISCLAIMER,
        age_band=band,
    )
