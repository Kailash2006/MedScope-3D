"""Auth: register/login/me, admin gating via JWT, and session ownership."""
from __future__ import annotations

import uuid


def _email() -> str:
    return f"user_{uuid.uuid4().hex[:8]}@example.com"


def test_register_login_me_flow(client):
    email = _email()
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["email"] == email
    assert body["user"]["role"] == "user"
    token = body["token"]

    # duplicate registration is rejected
    dup = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    assert dup.status_code == 409

    # /me with the bearer token
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email

    # login returns a working token
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    assert login.status_code == 200
    assert login.json()["user"]["email"] == email


def test_login_wrong_password_rejected(client):
    email = _email()
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    bad = client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpassword"})
    assert bad.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_admin_dashboard_accepts_admin_jwt(client, monkeypatch):
    # Promote a fresh email to admin via ADMIN_EMAILS, then register + hit the dashboard.
    from app.core.config import settings

    email = _email()
    monkeypatch.setattr(settings, "admin_emails", email)
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    assert r.json()["user"]["role"] == "admin"
    token = r.json()["token"]

    ok = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert ok.status_code == 200
    assert "totals" in ok.json()


def test_admin_dashboard_rejects_normal_user(client):
    email = _email()
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    token = r.json()["token"]
    forbidden = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert forbidden.status_code == 403


def test_session_attaches_to_user_and_shows_in_history(client):
    email = _email()
    token = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"}).json()["token"]
    hdr = {"Authorization": f"Bearer {token}"}

    sid = client.post("/api/v1/sessions", json={}, headers=hdr).json()["id"]
    client.patch(f"/api/v1/sessions/{sid}", json={"symptoms": [{"code": "headache", "severity": 4}]}, headers=hdr)

    mine = client.get("/api/v1/auth/me/sessions", headers=hdr)
    assert mine.status_code == 200
    ids = [s["id"] for s in mine.json()]
    assert sid in ids


def test_anonymous_session_has_no_owner(client):
    sid = client.post("/api/v1/sessions", json={}).json()["id"]
    # An anonymous session must not appear in any user's history.
    email = _email()
    token = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"}).json()["token"]
    mine = client.get("/api/v1/auth/me/sessions", headers={"Authorization": f"Bearer {token}"})
    assert sid not in [s["id"] for s in mine.json()]
