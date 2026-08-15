"""Session timeline feeds vitals charts + symptom timeline."""


def test_timeline_returns_snapshots(client):
    sid = client.post("/api/v1/sessions", json={"age": 50}).json()["id"]
    client.patch(f"/api/v1/sessions/{sid}", json={"vitals": {"spo2": 92, "hr": 88}})
    client.patch(f"/api/v1/sessions/{sid}", json={"vitals": {"spo2": 86, "hr": 120},
                                                  "symptoms": [{"code": "difficulty_breathing", "severity": 7}]})

    tl = client.get(f"/api/v1/sessions/{sid}/timeline").json()
    assert len(tl) == 2
    assert tl[0]["vitals"]["spo2"] == 92
    assert tl[1]["vitals"]["hr"] == 120
    assert tl[1]["symptoms"][0]["code"] == "difficulty_breathing"
    assert all("at" in p and "urgency" in p for p in tl)
