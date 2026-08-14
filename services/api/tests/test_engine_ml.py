"""Engine + ML integration: ML baseline, low-confidence fallback, model error,
and the invariant that red flags still dominate ML."""
from app.ml.prediction_service import PredictionError
from app.triage import SymptomEntry, TriageInput, Vitals, assess


def _mk(**kw) -> TriageInput:
    vitals = Vitals(**kw.pop("vitals", {}))
    symptoms = [SymptomEntry(**s) for s in kw.pop("symptoms", [])]
    return TriageInput(vitals=vitals, symptoms=symptoms, **kw)


class FakePredictor:
    def __init__(self, urgency="DOCTOR_SOON", confidence=0.9, low=False, raise_err=False):
        self.ready = True
        self._u, self._c, self._low, self._raise = urgency, confidence, low, raise_err

    def predict(self, inp):
        if self._raise:
            raise PredictionError("boom")
        return {"urgency": self._u, "confidence": self._c, "low_confidence": self._low,
                "model_version": "test-v1"}


def test_ml_confident_sets_ml_path():
    r = assess(_mk(age=30, symptoms=[{"code": "headache", "severity": 3}]),
               FakePredictor("URGENT_TODAY", 0.88))
    assert r.urgency == "URGENT_TODAY"
    assert r.decision_path == "ML"
    assert r.model_version == "test-v1"
    assert abs(r.confidence - 0.88) < 1e-6


def test_ml_low_confidence_falls_back():
    r = assess(_mk(age=30, symptoms=[{"code": "headache", "severity": 3}]),
               FakePredictor("SELF_CARE", 0.30, low=True))
    assert r.decision_path == "FALLBACK_LOW_CONF"
    assert r.urgency == "DOCTOR_SOON"  # conservative fallback, not the low-conf ML label


def test_ml_error_falls_back_model_error():
    r = assess(_mk(age=30, symptoms=[{"code": "headache", "severity": 3}]),
               FakePredictor(raise_err=True))
    assert r.decision_path == "FALLBACK_MODEL_ERROR"


def test_red_flag_dominates_ml():
    # ML says SELF_CARE but hypoxia is an EMERGENCY red flag -> EMERGENCY wins.
    r = assess(_mk(age=40, vitals={"spo2": 85}), FakePredictor("SELF_CARE", 0.99))
    assert r.urgency == "EMERGENCY"
    assert r.decision_path == "VITALS_RED_FLAG"


def test_not_ready_predictor_is_model_error():
    class NotReady:
        ready = False
    r = assess(_mk(age=30, symptoms=[{"code": "headache", "severity": 2}]), NotReady())
    assert r.decision_path == "FALLBACK_MODEL_ERROR"
