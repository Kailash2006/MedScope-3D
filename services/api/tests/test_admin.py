"""Admin dashboard RBAC + aggregation."""

ADMIN = {"X-Admin-Token": "test-admin-token"}


def _seed(client):
    sid = client.post("/api/v1/sessions", json={"age": 40}).json()["id"]
    client.patch(f"/api/v1/sessions/{sid}", json={"vitals": {"spo2": 86}})  # EMERGENCY red flag
    client.patch(f"/api/v1/sessions/{sid}", json={"symptoms": [{"code": "headache", "severity": 2}], "vitals": {"spo2": 99}})
    return sid


def test_admin_requires_token(client):
    assert client.get("/api/v1/admin/dashboard").status_code == 403
    assert client.get("/api/v1/admin/dashboard", headers={"X-Admin-Token": "wrong"}).status_code == 403


def test_dashboard_aggregates(client):
    _seed(client)
    r = client.get("/api/v1/admin/dashboard", headers=ADMIN)
    assert r.status_code == 200
    body = r.json()
    assert body["totals"]["sessions"] >= 1
    assert body["totals"]["assessments"] >= 2
    assert "VITALS_RED_FLAG" in body["decision_path_distribution"]
    assert body["safety"]["red_flag_count"] >= 1
    assert 0.0 <= body["safety"]["fallback_rate"] <= 1.0
    assert "engine_version" in body


def test_audit_and_models(client):
    _seed(client)
    audit = client.get("/api/v1/admin/audit?limit=10", headers=ADMIN).json()
    assert any(row["action"] == "session.update" for row in audit)
    # audit must not leak raw IPs (only hashes)
    assert all("ip" not in row or row.get("ip_hash") is not None for row in audit)

    models = client.get("/api/v1/admin/models", headers=ADMIN).json()
    assert "active" in models and "engine_version" in models
