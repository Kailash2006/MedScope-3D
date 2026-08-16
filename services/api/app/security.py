"""Admin RBAC guard (Phase 5 stand-in).

A shared admin token via the `X-Admin-Token` header gates the admin dashboard.
This is deliberately minimal; full user roles / magic-link auth arrive in Phase 6.
Empty ADMIN_TOKEN disables admin entirely (fail closed).
"""
from __future__ import annotations

import hmac

import jwt
from fastapi import Header, HTTPException, status

from .auth.service import decode_token
from .core.config import settings


def require_admin(
    x_admin_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """Admin access via EITHER a valid admin-role JWT (Authorization: Bearer)
    OR the legacy shared X-Admin-Token (kept for backward compatibility)."""
    # 1) Real admin account (JWT with role=admin).
    if authorization and authorization.lower().startswith("bearer "):
        try:
            if decode_token(authorization[7:].strip()).get("role") == "admin":
                return
        except jwt.PyJWTError:
            pass
    # 2) Legacy shared token.
    configured = settings.admin_token
    if configured and x_admin_token and hmac.compare_digest(x_admin_token, configured):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin access required")
