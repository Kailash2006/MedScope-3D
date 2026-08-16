from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session as OrmSession

from ..audit import logger as audit
from ..auth.service import (
    create_token,
    current_user,
    hash_password,
    role_for,
    verify_password,
)
from ..core.db import get_db
from ..models.db import Assessment, Session, User
from ..ratelimit import rate_limit

router = APIRouter(prefix="/api/v1/auth", tags=["auth"], dependencies=[Depends(rate_limit)])


class Credentials(BaseModel):
    email: EmailStr
    # bcrypt caps at 72 bytes; enforce here so hashing never truncates silently.
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    id: str
    email: str
    role: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _auth_out(user: User) -> AuthOut:
    return AuthOut(token=create_token(user), user=UserOut(id=user.id, email=user.email, role=user.role))


@router.post("/register", response_model=AuthOut, status_code=201)
def register(creds: Credentials, request: Request, db: OrmSession = Depends(get_db)) -> AuthOut:
    email = creds.email.lower()
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")
    user = User(email=email, password_hash=hash_password(creds.password), role=role_for(email))
    db.add(user)
    db.flush()
    audit.record(db, "user.register", "user", user.id, ip=_client_ip(request), meta={"role": user.role})
    db.commit()
    return _auth_out(user)


@router.post("/login", response_model=AuthOut)
def login(creds: Credentials, request: Request, db: OrmSession = Depends(get_db)) -> AuthOut:
    email = creds.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(creds.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid email or password")
    # Re-sync role from ADMIN_EMAILS so promotion/demotion takes effect on next login.
    desired = role_for(email)
    if user.role != desired:
        user.role = desired
    audit.record(db, "user.login", "user", user.id, ip=_client_ip(request))
    db.commit()
    return _auth_out(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email, role=user.role)


@router.get("/me/sessions")
def my_sessions(user: User = Depends(current_user), db: OrmSession = Depends(get_db)) -> list[dict]:
    """Triage sessions owned by the logged-in user, with their latest assessment."""
    rows = (
        db.query(Session).filter(Session.user_id == user.id)
        .order_by(Session.created_at.desc()).all()
    )
    out = []
    for s in rows:
        latest = (
            db.query(Assessment).filter(Assessment.session_id == s.id)
            .order_by(Assessment.created_at.desc()).first()
        )
        out.append({
            "id": s.id,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
            "symptoms": s.symptoms or [],
            "regions": s.regions or [],
            "latest_urgency": latest.urgency if latest else None,
            "latest_decision_path": latest.decision_path if latest else None,
            "assessment_count": db.query(Assessment).filter(Assessment.session_id == s.id).count(),
        })
    return out
