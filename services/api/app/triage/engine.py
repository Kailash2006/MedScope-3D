"""Triage engine orchestration: completeness gate -> red flags -> ML -> fallback.

The single entry point `assess()` runs the deterministic safety pipeline and
returns a fully-populated TriageResult, including a decision_path on every call.
An optional PredictionService supplies the ML baseline; red-flag rules always
run first and can only escalate the result, never downgrade it.
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
from .fallback import apply_age_modifier, conservative_fallback, has_assessable_input
from .models import ReasonOut, TriageInput, TriageResult
from .rules import evaluate_symptoms, evaluate_vitals

_CONF_RED_FLAG = 0.99
_CONF_FALLBACK = 0.5
_CONF_INSUFFICIENT = 0.0


def assess(inp: TriageInput, predictor=None) -> TriageResult:
    band = resolve_band(inp.age)

    # 1. Completeness gate.
    if not has_assessable_input(inp):
        return _result(
            UrgencyLevel.INSUFFICIENT_INFO, _CONF_INSUFFICIENT,
            [ReasonOut(type=ReasonType.FALLBACK.value, rule=None,
                       message="No symptoms, regions, or vitals provided.")],
            DecisionPath.FALLBACK_MISSING, band, "none",
        )

    # 2 + 3. Red-flag rules (vitals then symptoms).
    vitals_fires = evaluate_vitals(inp, band)
    symptom_fires = evaluate_symptoms(inp, band)
    all_fires = vitals_fires + symptom_fires
    red_flag_level = None
    for f in all_fires:
        red_flag_level = f.urgency if red_flag_level is None else escalate(red_flag_level, f.urgency)

    reasons: list[ReasonOut] = [
        ReasonOut(type=ReasonType.RED_FLAG.value, rule=f.rule_id, message=f.message)
        for f in all_fires
    ]

    # 4. ML baseline (if a confident prediction is available), else conservative.
    baseline_level, baseline_path, baseline_conf, model_version = _baseline(inp, band, predictor, reasons)

    # 5. Age-extreme modifier only nudges the conservative fallback, never ML/red flags.
    if baseline_path in (DecisionPath.FALLBACK_MODEL_ERROR, DecisionPath.FALLBACK_LOW_CONF):
        baseline_level, modifier_applied = apply_age_modifier(
            baseline_level, inp, band, had_vitals_red_flag=bool(vitals_fires))
        if modifier_applied:
            reasons.append(ReasonOut(
                type=ReasonType.INFO.value, rule="modifiers.age_extreme",
                message=f"Escalated one level for age band '{band}' on a borderline presentation."))

    # 6. Escalate-only merge: red flags dominate; baseline is the floor.
    final = baseline_level if red_flag_level is None else escalate(red_flag_level, baseline_level)

    if red_flag_level is not None and rank_of(final) == rank_of(red_flag_level):
        won_via_vitals = any(rank_of(f.urgency) == rank_of(final) for f in vitals_fires)
        decision_path = DecisionPath.VITALS_RED_FLAG if won_via_vitals else DecisionPath.SYMPTOM_RED_FLAG
        confidence = _CONF_RED_FLAG
    else:
        decision_path = baseline_path
        confidence = baseline_conf

    return _result(final, confidence, reasons, decision_path, band, model_version)


def _baseline(inp, band, predictor, reasons) -> tuple:
    """Return (level, decision_path, confidence, model_version) for the non-red-flag baseline."""
    if predictor is not None and getattr(predictor, "ready", False):
        from ..ml.prediction_service import PredictionError

        try:
            ml = predictor.predict(inp)
        except PredictionError as exc:
            reasons.append(ReasonOut(type=ReasonType.FALLBACK.value, rule=None,
                                     message=f"ML prediction failed ({exc}); conservative fallback applied."))
            return conservative_fallback(inp), DecisionPath.FALLBACK_MODEL_ERROR, _CONF_FALLBACK, "none"

        if ml["low_confidence"]:
            reasons.append(ReasonOut(type=ReasonType.FALLBACK.value, rule=None,
                                     message=f"ML confidence {ml['confidence']:.2f} below threshold; conservative fallback."))
            return conservative_fallback(inp), DecisionPath.FALLBACK_LOW_CONF, _CONF_FALLBACK, ml["model_version"]

        reasons.append(ReasonOut(type=ReasonType.ML.value, rule=None,
                                 message=f"ML urgency={ml['urgency']} confidence={ml['confidence']:.2f}."))
        return UrgencyLevel(ml["urgency"]), DecisionPath.ML, ml["confidence"], ml["model_version"]

    # No predictor available at all.
    reasons.append(ReasonOut(type=ReasonType.FALLBACK.value, rule=None,
                             message="ML model not available; conservative fallback applied."))
    return conservative_fallback(inp), DecisionPath.FALLBACK_MODEL_ERROR, _CONF_FALLBACK, "none"


def _result(urgency, confidence, reasons, decision_path, band, model_version) -> TriageResult:
    return TriageResult(
        urgency=urgency.value if isinstance(urgency, UrgencyLevel) else urgency,
        confidence=confidence,
        reasons=reasons,
        decision_path=decision_path.value,
        advice=advice_of(urgency),
        model_version=model_version,
        engine_version=settings.engine_version,
        disclaimer=DISCLAIMER,
        age_band=band,
    )
