from __future__ import annotations

from fastapi import Request


def get_predictor(request: Request):
    """The process-wide PredictionService, loaded at startup (may be not-ready)."""
    return getattr(request.app.state, "predictor", None)
