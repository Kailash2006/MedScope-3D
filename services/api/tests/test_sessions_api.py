"""Sessions CRUD + persistence + audit."""


def test_session_lifecycle(client):
    # create
    r = client.post("/api/v1/sessions", json={"age": 40, "sex": "M"})
    assert r.status_code == 201
    sid = r.json()["id"]
    assert r.json()["latest_assessment"] is None

    # patch with an emergency vital -> recompute EMERGENCY, persisted
    r = client.patch(f"/api/v1/sessions/{sid}", json={"vitals": {"spo2": 86}})
    assert r.status_code == 200
    assert r.json()["urgency"] == "EMERGENCY"
    assert r.json()["decision_path"] == "VITALS_RED_FLAG"

    # get shows latest assessment
    r = client.get(f"/api/v1/sessions/{sid}")
    assert r.json()["latest_assessment"]["urgency"] == "EMERGENCY"
    assert r.json()["vitals"]["spo2"] == 86

    # a second patch appends to history
    client.patch(f"/api/v1/sessions/{sid}", json={"symptoms": [{"code": "headache", "severity": 2}],
                                                   "vitals": {"spo2": 99}})
    hist = client.get(f"/api/v1/sessions/{sid}/history").json()
    assert len(hist) == 2


def test_get_missing_session_404(client):
    assert client.get("/api/v1/sessions/does-not-exist").status_code == 404


def test_patch_validation_error(client):
    sid = client.post("/api/v1/sessions", json={}).json()["id"]
    r = client.patch(f"/api/v1/sessions/{sid}", json={"symptoms": [{"code": "x", "severity": 50}]})
    assert r.status_code == 422
