"""PredictionService: loads a real artifact, predicts, and fails safe."""
from app.ml.prediction_service import PredictionService
from app.triage import TriageInput, Vitals


def test_missing_dir_is_not_ready():
    svc = PredictionService.from_dir("/definitely/not/here")
    assert svc.ready is False
    assert svc.health()["ready"] is False


def test_loads_real_artifact_and_predicts_emergency(tmp_artifact):
    svc = PredictionService.from_dir(tmp_artifact)
    assert svc.ready is True
    out = svc.predict(TriageInput(age=40, sex="M", vitals=Vitals(spo2=84)))
    assert out["urgency"] == "EMERGENCY"
    assert 0.0 <= out["confidence"] <= 1.0
    assert out["model_version"]
