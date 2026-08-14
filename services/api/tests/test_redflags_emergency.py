"""Emergency red-flag suite — the Phase 1 acceptance gate. MUST be 100% green.

Every case here represents a presentation that must never be under-triaged: the
engine is required to return EMERGENCY via a red-flag decision path.
"""
import pytest

from app.triage import SymptomEntry, TriageInput, Vitals, assess

RED_FLAG_PATHS = {"VITALS_RED_FLAG", "SYMPTOM_RED_FLAG"}


def _mk(**kw) -> TriageInput:
    vitals = Vitals(**kw.pop("vitals", {}))
    symptoms = [SymptomEntry(**s) for s in kw.pop("symptoms", [])]
    return TriageInput(vitals=vitals, symptoms=symptoms, **kw)


# ── Adult vitals red flags ────────────────────────────────────────────────
ADULT_VITALS_EMERGENCIES = [
    ("hr_high", {"hr": 135}),
    ("hr_low", {"hr": 35}),
    ("rr_high", {"rr": 32}),
    ("rr_low", {"rr": 6}),
    ("spo2_low", {"spo2": 88}),
    ("sbp_low", {"sbp": 85}),
    ("temp_high", {"temp_c": 40.2}),
    ("temp_low", {"temp_c": 34.0}),
    ("sbp_htn_crisis", {"sbp": 185}),
    ("dbp_htn_crisis", {"dbp": 125}),
]


@pytest.mark.parametrize("name,vitals", ADULT_VITALS_EMERGENCIES, ids=[c[0] for c in ADULT_VITALS_EMERGENCIES])
def test_adult_vitals_emergency(name, vitals):
    r = assess(_mk(age=40, sex="M", vitals=vitals))
    assert r.urgency == "EMERGENCY", f"{name} -> {r.urgency}"
    assert r.decision_path in RED_FLAG_PATHS
    assert r.confidence >= 0.95


# ── Symptom red flags ─────────────────────────────────────────────────────
def test_cardiac_chest_pain_with_risk():
    r = assess(_mk(age=61, sex="M", regions=["chest_left", "arm_left"],
                   symptoms=[{"code": "chest_pain", "severity": 8}],
                   risk_factors=["hypertension"]))
    assert r.urgency == "EMERGENCY"
    assert r.decision_path in RED_FLAG_PATHS


def test_stroke_fast_any_severity():
    r = assess(_mk(age=70, symptoms=[{"code": "facial_droop", "severity": 3}]))
    assert r.urgency == "EMERGENCY"


def test_airway_difficulty_breathing():
    r = assess(_mk(age=30, symptoms=[{"code": "difficulty_breathing", "severity": 7}]))
    assert r.urgency == "EMERGENCY"


def test_anaphylaxis():
    r = assess(_mk(age=25, symptoms=[{"code": "swelling", "severity": 5},
                                     {"code": "difficulty_breathing", "severity": 6}],
                   risk_factors=["known_allergen_exposure"]))
    assert r.urgency == "EMERGENCY"


def test_thunderclap_headache():
    r = assess(_mk(age=45, symptoms=[{"code": "thunderclap_headache", "severity": 9}]))
    assert r.urgency == "EMERGENCY"


def test_meningitis_headache_neck_fever():
    r = assess(_mk(age=20, symptoms=[{"code": "headache", "severity": 6},
                                     {"code": "neck_stiffness", "severity": 5}],
                   vitals={"temp_c": 38.6}))
    assert r.urgency == "EMERGENCY"


def test_hemorrhage():
    r = assess(_mk(age=50, symptoms=[{"code": "uncontrolled_bleeding", "severity": 7}]))
    assert r.urgency == "EMERGENCY"


def test_sepsis_screen():
    # fever + tachycardia, but HR below the adult vitals red-flag threshold (130)
    r = assess(_mk(age=55, symptoms=[{"code": "fever", "severity": 5}],
                   vitals={"temp_c": 38.5, "hr": 125, "spo2": 96}))
    assert r.urgency == "EMERGENCY"
    assert r.decision_path == "SYMPTOM_RED_FLAG"


# ── Age-band specific ─────────────────────────────────────────────────────
def test_infant_fever_is_emergency():
    r = assess(_mk(age=0, vitals={"temp_c": 38.3}))
    assert r.urgency == "EMERGENCY"


def test_infant_bradycardia_threshold():
    # HR 85 is normal-ish for an adult but a red flag for an infant (<90).
    r = assess(_mk(age=0, vitals={"hr": 85}))
    assert r.urgency == "EMERGENCY"
    assert r.decision_path == "VITALS_RED_FLAG"


def test_older_adult_atypical_cardiac_lower_severity():
    # chest pain severity 5 fires for older_adult (threshold 5) but not a young adult (7)
    r = assess(_mk(age=72, symptoms=[{"code": "chest_pain", "severity": 5}],
                   risk_factors=["hypertension"]))
    assert r.urgency == "EMERGENCY"


def test_missing_age_uses_most_sensitive_threshold():
    # HR 125 with unknown age: most-sensitive high threshold across bands is 120
    # (older_adult), so this must fire even though the adult threshold is 130.
    r = assess(_mk(vitals={"hr": 125}))
    assert r.urgency == "EMERGENCY"
    assert r.decision_path == "VITALS_RED_FLAG"


# ── Urgent-today (non-emergency) red flags ────────────────────────────────
def test_pregnancy_abdominal_pain_urgent():
    r = assess(_mk(age=28, sex="F", symptoms=[{"code": "abdominal_pain", "severity": 8}],
                   risk_factors=["pregnancy"]))
    assert r.urgency == "URGENT_TODAY"
    assert r.decision_path == "SYMPTOM_RED_FLAG"


def test_pediatric_dehydration_urgent():
    r = assess(_mk(age=3, symptoms=[{"code": "vomiting", "severity": 4},
                                    {"code": "reduced_intake", "severity": 4}]))
    assert r.urgency == "URGENT_TODAY"
