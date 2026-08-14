"""WebSocket autosave + live recompute, and durability across reconnect."""


def test_ws_live_recompute_and_autosave_durability(client):
    sid = client.post("/api/v1/sessions", json={"age": 40, "sex": "M"}).json()["id"]

    with client.websocket_connect(f"/ws/sessions/{sid}") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "connected"
        assert hello["session_id"] == sid

        ws.send_json({"type": "update", "patch": {"vitals": {"spo2": 85}}})
        # server pushes the assessment (broadcast) and a saved ack (order may vary)
        msgs = [ws.receive_json(), ws.receive_json()]
        kinds = {m["type"] for m in msgs}
        assert {"assessment", "saved"} <= kinds
        assessment = next(m for m in msgs if m["type"] == "assessment")["data"]
        assert assessment["urgency"] == "EMERGENCY"
        assert assessment["decision_path"] == "VITALS_RED_FLAG"

    # autosave durability: after disconnect, the persisted state is still there
    got = client.get(f"/api/v1/sessions/{sid}").json()
    assert got["vitals"]["spo2"] == 85
    assert got["latest_assessment"]["urgency"] == "EMERGENCY"

    # reconnect sees the latest on connect
    with client.websocket_connect(f"/ws/sessions/{sid}") as ws:
        hello = ws.receive_json()
        assert hello["latest"]["urgency"] == "EMERGENCY"


def test_ws_unknown_session_errors(client):
    with client.websocket_connect("/ws/sessions/nope") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
