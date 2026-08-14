"""HTTP contract for POST /api/v1/triage/assess."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_assess_emergency_over_http():
    r = client.post("/api/v1/triage/assess", json={
        "age": 40, "sex": "M", "vitals": {"spo2": 87},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["urgency"] == "EMERGENCY"
    assert body["decision_path"] == "VITALS_RED_FLAG"
    assert body["model_version"] == "none"
    assert body["disclaimer"]
    assert body["assessed_at"]


def test_assess_insufficient_over_http():
    r = client.post("/api/v1/triage/assess", json={})
    assert r.status_code == 200
    assert r.json()["urgency"] == "INSUFFICIENT_INFO"


def test_assess_validation_rejects_bad_severity():
    r = client.post("/api/v1/triage/assess", json={
        "symptoms": [{"code": "headache", "severity": 99}],
    })
    assert r.status_code == 422  # severity out of 0..10 range
