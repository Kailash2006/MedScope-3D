"""Low-confidence / missing-data / fallback behavior."""
from app.triage import SymptomEntry, TriageInput, Vitals, assess


def _mk(**kw) -> TriageInput:
    vitals = Vitals(**kw.pop("vitals", {}))
    symptoms = [SymptomEntry(**s) for s in kw.pop("symptoms", [])]
    return TriageInput(vitals=vitals, symptoms=symptoms, **kw)


def test_empty_input_is_insufficient_info():
    r = assess(_mk())
    assert r.urgency == "INSUFFICIENT_INFO"
    assert r.decision_path == "FALLBACK_MISSING"
    assert r.confidence == 0.0


def test_no_redflag_falls_back_conservatively():
    r = assess(_mk(age=30, symptoms=[{"code": "headache", "severity": 3}]))
    assert r.urgency == "DOCTOR_SOON"
    assert r.decision_path == "FALLBACK_MODEL_ERROR"
    assert 0.0 < r.confidence < 0.95


def test_high_severity_without_redflag_is_urgent_fallback():
    r = assess(_mk(age=30, symptoms=[{"code": "abdominal_pain", "severity": 9}]))
    assert r.urgency == "URGENT_TODAY"
    assert r.decision_path == "FALLBACK_MODEL_ERROR"


def test_regions_only_is_self_care_fallback():
    r = assess(_mk(age=30, regions=["arm_left"]))
    assert r.urgency == "SELF_CARE"
    assert r.decision_path == "FALLBACK_MODEL_ERROR"


def test_missing_vital_never_reads_as_reassuring():
    # chest pain + risk but NO vitals: cardiac rule still needs region/risk, and
    # absent vitals must not manufacture a reassuring downgrade.
    r = assess(_mk(age=61, symptoms=[{"code": "chest_pain", "severity": 8}],
                   regions=["arm_left"], risk_factors=["smoker"]))
    assert r.urgency == "EMERGENCY"


def test_age_extreme_modifier_escalates_borderline():
    # older adult, borderline severity 6, no red flag -> fallback DOCTOR_SOON
    # escalated one level to URGENT_TODAY by the age modifier.
    r = assess(_mk(age=80, symptoms=[{"code": "headache", "severity": 6}]))
    assert r.urgency == "URGENT_TODAY"
    assert any(x.rule == "modifiers.age_extreme" for x in r.reasons)


def test_every_response_has_decision_path_and_disclaimer():
    for inp in [_mk(), _mk(age=30, symptoms=[{"code": "headache", "severity": 2}]),
                _mk(age=40, vitals={"spo2": 88})]:
        r = assess(inp)
        assert r.decision_path
        assert "not a diagnosis" in r.disclaimer.lower()
        assert r.model_version == "none"
