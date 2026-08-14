"""Append-only audit logging. No PHI in metadata; IPs are hashed."""
from __future__ import annotations

import hashlib

from sqlalchemy.orm import Session as OrmSession

from ..core.config import settings
from ..models.db import AuditLog


def hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(f"{settings.session_secret}:{ip}".encode()).hexdigest()[:32]


def record(
    db: OrmSession,
    action: str,
    target_type: str,
    target_id: str | None = None,
    ip: str | None = None,
    meta: dict | None = None,
    note: str | None = None,
    actor_user_id: str | None = None,
) -> None:
    """Write one audit row. Never stores raw IP or clinical free text in metadata."""
    db.add(AuditLog(
        action=action, target_type=target_type, target_id=target_id,
        ip_hash=hash_ip(ip), meta=meta or {}, note=note, actor_user_id=actor_user_id,
    ))
    db.flush()
