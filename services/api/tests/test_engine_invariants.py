"""Safety invariants: escalate-only, no red-flag downgrade, modifier never
fabricates EMERGENCY."""
from triage_shared import rank_of

from app.triage import SymptomEntry, TriageInput, Vitals, assess


def _mk(**kw) -> TriageInput:
    vitals = Vitals(**kw.pop("vitals", {}))
    symptoms = [SymptomEntry(**s) for s in kw.pop("symptoms", [])]
    return TriageInput(vitals=vitals, symptoms=symptoms, **kw)


BASE_CASES = [
    _mk(age=30, symptoms=[{"code": "headache", "severity": 2}]),
    _mk(age=30, regions=["arm_left"]),
    _mk(age=55, symptoms=[{"code": "abdominal_pain", "severity": 4}]),
    _mk(age=8, symptoms=[{"code": "fever", "severity": 3}], vitals={"temp_c": 38.2}),
    _mk(age=72, symptoms=[{"code": "headache", "severity": 6}]),
]


def test_adding_emergency_vital_never_downgrades():
    """For any base case, adding a hypoxia red flag must yield EMERGENCY and never
    a lower rank than the base assessment."""
    for base in BASE_CASES:
        before = assess(base)
        worse = base.model_copy(deep=True)
        worse.vitals.spo2 = 85  # hypoxia red flag
        after = assess(worse)
        assert after.urgency == "EMERGENCY"
        assert rank_of(after.urgency) >= rank_of(before.urgency)


def test_red_flag_never_downgraded_by_fallback_floor():
    # A red flag (EMERGENCY) coexisting with a trivial symptom must remain EMERGENCY.
    r = assess(_mk(age=40, symptoms=[{"code": "headache", "severity": 1}],
                   vitals={"spo2": 84}))
    assert r.urgency == "EMERGENCY"


def test_age_modifier_never_produces_emergency():
    # Borderline older-adult case: modifier may lift to URGENT_TODAY at most.
    r = assess(_mk(age=85, symptoms=[{"code": "abdominal_pain", "severity": 6}]))
    assert r.urgency in {"DOCTOR_SOON", "URGENT_TODAY"}
    assert r.urgency != "EMERGENCY"


def test_multiple_red_flags_pick_highest():
    # hypoxia (EMERGENCY) + pregnancy abdo (URGENT_TODAY) -> EMERGENCY wins.
    r = assess(_mk(age=28, sex="F", symptoms=[{"code": "abdominal_pain", "severity": 8}],
                   risk_factors=["pregnancy"], vitals={"spo2": 86}))
    assert r.urgency == "EMERGENCY"
    assert r.decision_path == "VITALS_RED_FLAG"
