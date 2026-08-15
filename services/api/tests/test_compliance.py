"""Data-rights: export, delete (cascade), retention settings, and purge."""
from datetime import UTC, datetime, timedelta

from app.core.db import SessionLocal
from app.models.db import Assessment, Session

ADMIN = {"X-Admin-Token": "test-admin-token"}


def _make(client) -> str:
    sid = client.post("/api/v1/sessions", json={"age": 40}).json()["id"]
    client.patch(f"/api/v1/sessions/{sid}", json={"vitals": {"spo2": 86}})
    return sid


def test_export_bundle(client):
    sid = _make(client)
    b = client.get(f"/api/v1/sessions/{sid}/export").json()
    assert b["session"]["id"] == sid
    assert len(b["assessments"]) >= 1
    assert "not a diagnosis" in b["disclaimer"].lower()
    assert b["privacy_note"]
    # audit trail for this session is included (export itself is audited too)
    assert any(a["action"] in {"session.update", "session.export"} for a in b["audit_logs"])


def test_delete_purges_cascade(client):
    sid = _make(client)
    r = client.delete(f"/api/v1/sessions/{sid}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True
    assert r.json()["assessments_deleted"] >= 1
    # session gone, and no orphan assessments remain
    assert client.get(f"/api/v1/sessions/{sid}").status_code == 404
    db = SessionLocal()
    try:
        assert db.get(Session, sid) is None
        assert db.query(Assessment).filter(Assessment.session_id == sid).count() == 0
    finally:
        db.close()


def test_set_retention_moves_expiry(client):
    sid = client.post("/api/v1/sessions", json={"age": 30}).json()["id"]
    out = client.patch(f"/api/v1/sessions/{sid}/retention", json={"retention_days": 1}).json()
    created = datetime.fromisoformat(out["created_at"])
    expires = datetime.fromisoformat(out["expires_at"])
    assert abs((expires - created) - timedelta(days=1)) < timedelta(seconds=5)


def test_purge_expired_removes_old_sessions(client):
    sid = _make(client)
    # force expiry into the past
    db = SessionLocal()
    try:
        row = db.get(Session, sid)
        row.expires_at = datetime.now(UTC) - timedelta(days=1)
        db.commit()
    finally:
        db.close()

    purged = client.post("/api/v1/admin/purge", headers=ADMIN).json()["purged_sessions"]
    assert purged >= 1
    assert client.get(f"/api/v1/sessions/{sid}").status_code == 404


def test_settings_and_privacy(client):
    ret = client.get("/api/v1/settings/retention").json()
    assert ret["default_retention_days"] >= 1
    priv = client.get("/api/v1/settings/privacy").json()
    assert priv["privacy_note"] and priv["disclaimer"]
