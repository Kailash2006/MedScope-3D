"""Admin RBAC guard (Phase 5 stand-in).

A shared admin token via the `X-Admin-Token` header gates the admin dashboard.
This is deliberately minimal; full user roles / magic-link auth arrive in Phase 6.
Empty ADMIN_TOKEN disables admin entirely (fail closed).
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from .core.config import settings


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    configured = settings.admin_token
    if not configured:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin disabled")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, configured):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin token required")
