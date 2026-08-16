from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


# SQLite (tests) needs check_same_thread off; Postgres ignores it.
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    # Prototype: create tables from models. Alembic migrations are a Phase 7 item.
    from ..models import db as _models  # noqa: F401  (ensure models are registered)

    Base.metadata.create_all(bind=engine)  # creates any NEW tables (e.g. users)

    # Lightweight, idempotent column migration for the auth feature: create_all
    # does not ALTER an existing `sessions` table, so add `user_id` if missing.
    # Works on Postgres (Neon) and SQLite; skipped when the column already exists
    # (fresh test DBs already have it from create_all).
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "sessions" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("sessions")}
        if "user_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE sessions ADD COLUMN user_id VARCHAR(36)"))


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
