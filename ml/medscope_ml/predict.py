"""Serving-side predictor — the ML half of the future PredictionService (Phase 3).

Uses the SAME features.build_frame() as training (skew guard) and asserts the
artifact's stored feature columns match; a mismatch raises so the caller can fail
safe to FALLBACK_MODEL_ERROR rather than silently mis-map columns.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np

from . import features as F


def load_artifact(path: str | Path) -> dict:
    return joblib.load(path)


def predict(artifact: dict, record: dict[str, Any]) -> dict:
    cols = artifact["feature_columns"]
    if cols != F.feature_columns():
        raise ValueError("feature contract drift: artifact columns != current features.feature_columns()")

    X = F.build_frame([record])[cols].to_numpy(dtype=np.float32)
    proba = artifact["model"].predict_proba(X)[0]
    classes = artifact["classes"]

    idx = int(np.argmax(proba))
    tau_e = artifact.get("emergency_threshold", 0.5)
    if "EMERGENCY" in classes and proba[classes.index("EMERGENCY")] >= tau_e:
        idx = classes.index("EMERGENCY")

    confidence = float(proba[idx])
    return {
        "urgency": classes[idx],
        "confidence": confidence,
        "low_confidence": confidence < artifact.get("confidence_threshold", 0.6),
        "model_version": artifact.get("model_version"),
        "proba": {c: float(p) for c, p in zip(classes, proba)},
    }
