from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    engine_version: str = "2026.08.1"

    database_url: str = "postgresql+psycopg://medscope:change_me_dev_only@db:5432/medscope"
    redis_url: str = "redis://redis:6379/0"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"
    session_secret: str = "change_me_dev_only_min_32_chars_please"

    ml_artifact_dir: str = "/app/ml/artifacts"
    ml_confidence_threshold: float = 0.6

    default_retention_days: int = 30
    audit_retention_days: int = 365

    # Admin dashboard RBAC (Phase 5 stand-in until full user roles in Phase 6).
    # Empty => admin endpoints are disabled (return 403 for everyone).
    admin_token: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
