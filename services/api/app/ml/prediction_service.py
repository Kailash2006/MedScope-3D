"""PredictionService — the boundary between the triage engine and the ML artifact.

Loads a joblib artifact produced by the ml/ pipeline and exposes predict(). Any
load/predict failure or feature-contract drift leaves the service not-ready or
raises PredictionError, so the engine falls back conservatively (fail safe).
"""
from __future__ import annotations

from pathlib import Path

from ..triage.models import TriageInput


class PredictionError(Exception):
    pass


def input_to_record(inp: TriageInput) -> dict:
    """Convert the API's TriageInput into the semantic record medscope_ml expects."""
    return {
        "age": inp.age,
        "sex": inp.sex,
        "regions": list(inp.regions),
        "risk_factors": list(inp.risk_factors),
        "symptoms": [
            {"code": s.code, "severity": s.severity, "duration_hours": s.duration_hours}
            for s in inp.symptoms
        ],
        "vitals": inp.vitals.model_dump(),
    }


class PredictionService:
    def __init__(self, artifact_path: Path | None = None):
        self.artifact = None
        self.model_version = "none"
        self._predict_fn = None
        self.error: str | None = None
        if artifact_path is not None:
            self._load(artifact_path)

    @classmethod
    def from_dir(cls, artifact_dir: str | Path) -> PredictionService:
        d = Path(artifact_dir)
        models = sorted(d.glob("model_*.joblib")) if d.exists() else []
        return cls(models[-1] if models else None)

    def _load(self, path: Path) -> None:
        try:
            from medscope_ml.predict import load_artifact, predict  # lazy: heavy deps

            self.artifact = load_artifact(path)
            self._predict_fn = predict
            self.model_version = self.artifact.get("model_version", "unknown")
        except Exception as exc:  # noqa: BLE001 - any failure => stay not-ready (fail safe)
            self.error = f"{type(exc).__name__}: {exc}"
            self.artifact = None

    @property
    def ready(self) -> bool:
        return self.artifact is not None and self._predict_fn is not None

    def predict(self, inp: TriageInput) -> dict:
        if not self.ready:
            raise PredictionError(self.error or "model not loaded")
        try:
            out = self._predict_fn(self.artifact, input_to_record(inp))
        except Exception as exc:
            raise PredictionError(str(exc)) from exc
        return {
            "urgency": out["urgency"],
            "confidence": float(out["confidence"]),
            "low_confidence": bool(out["low_confidence"]),
            "model_version": out.get("model_version", self.model_version),
        }

    def health(self) -> dict:
        return {"ready": self.ready, "model_version": self.model_version, "error": self.error}
