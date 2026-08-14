"""Safety-first evaluation: emergency recall gate + under-triage reporting.

Missing an EMERGENCY is the worst error the model can make, so EMERGENCY recall
is a hard release gate. Under-triage (predicting a less urgent class than the
truth) is reported per class.
"""
from __future__ import annotations

import math

import numpy as np
from triage_shared import rank_of

EMERGENCY = "EMERGENCY"


def emergency_recall(y_true, y_pred) -> float:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = y_true == EMERGENCY
    if mask.sum() == 0:
        return float("nan")
    return float((y_pred[mask] == EMERGENCY).mean())


def under_triage_rate(y_true, y_pred) -> float:
    """Fraction of cases where predicted urgency rank < true urgency rank."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    under = sum(rank_of(p) < rank_of(t) for t, p in zip(y_true, y_pred))
    return float(under / len(y_true)) if len(y_true) else 0.0


def emergency_under_triage_count(y_true, y_pred) -> int:
    """How many true EMERGENCY cases were predicted as anything less urgent."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = y_true == EMERGENCY
    return int((y_pred[mask] != EMERGENCY).sum())


def safety_report(y_true, y_pred, min_recall: float) -> dict:
    rec = emergency_recall(y_true, y_pred)
    return {
        "emergency_recall": rec,
        "emergency_recall_min": min_recall,
        "emergency_missed": emergency_under_triage_count(y_true, y_pred),
        "under_triage_rate": under_triage_rate(y_true, y_pred),
        "gate_passed": bool(rec >= min_recall) if not math.isnan(rec) else False,
    }
