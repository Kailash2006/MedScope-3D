from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_readyz():
    r = client.get("/readyz")
    assert r.status_code == 200


def test_meta_exposes_levels_and_disclaimer():
    r = client.get("/api/v1/meta")
    assert r.status_code == 200
    body = r.json()
    assert "EMERGENCY" in body["urgency_levels"]
    assert "not" in body["disclaimer"].lower()
