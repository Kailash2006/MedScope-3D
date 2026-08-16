"""Auth core: password hashing (bcrypt), JWT (PyJWT), and FastAPI dependencies.

Tokens are bearer JWTs (Authorization: Bearer <token>) — chosen over cookies
because the web app (Vercel) and API (Render) are on different domains, where
cross-site cookies are unreliable.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session as OrmSession

from ..core.config import settings
from ..core.db import get_db
from ..models.db import User

ALGO = "HS256"


def hash_password(password: str) -> str:
    # bcrypt caps at 72 bytes; the register schema enforces max_length=72.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def role_for(email: str) -> str:
    return "admin" if email.strip().lower() in settings.admin_email_list else "user"


def create_token(user: User) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_signing_secret, algorithm=ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_signing_secret, algorithms=[ALGO])


def _bearer(authorization: str | None = Header(default=None)) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def current_user_optional(
    token: str | None = Depends(_bearer), db: OrmSession = Depends(get_db)
) -> User | None:
    """Return the authenticated user if a valid token is present, else None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        return db.get(User, payload.get("sub"))
    except (jwt.PyJWTError, KeyError):
        return None


def current_user(user: User | None = Depends(current_user_optional)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
    return user


def require_admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    return user
