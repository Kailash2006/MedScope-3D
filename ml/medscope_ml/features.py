"""Feature expansion — the ONE place a semantic case becomes a model vector.

Used by the dataset generator now and by the serving PredictionService later, so
training and serving cannot drift (Addendum B). Column order is derived
deterministically from triage_shared.feature_contract().

A semantic record looks like:
    {"age": 61, "sex": "M",
     "regions": ["chest_left"],
     "symptoms": [{"code": "chest_pain", "severity": 8, "duration_hours": 1}],
     "risk_factors": ["hypertension"],
     "vitals": {"hr": 120, "sbp": 90, "dbp": 60, "spo2": 94, "temp_c": 37.2, "rr": 20}}
"""
from __future__ import annotations

from collections import OrderedDict
from typing import Any

import pandas as pd
from triage_shared import feature_contract, red_flag_table

_FC = feature_contract()
_BANDS = red_flag_table()["age_bands"]

_NUMERIC = _FC["numeric_features"]
_MISSING = _FC["missing_indicator_features"]
_VITALS = ["hr", "sbp", "dbp", "spo2", "temp_c", "rr"]
_REGIONS = _FC["multihot_features"]["regions"]
_SYMPTOMS = _FC["multihot_features"]["symptom_codes"]
_RISKS = _FC["multihot_features"]["risk_factors"]

_SEX_CATS = ["M", "F", "O", "unknown"]
_BAND_CATS = [b["band"] for b in _BANDS] + ["unknown"]

# "Assume normal" fills for missing vitals. The paired *_missing indicator tells
# the model the value was imputed, so this never silently reads as a real reading.
_VITAL_FILL = {"hr": 80.0, "sbp": 120.0, "dbp": 78.0, "spo2": 98.0, "temp_c": 37.0, "rr": 16.0}
_AGE_FILL = 40.0


def resolve_band(age: int | None) -> str:
    if age is None:
        return "unknown"
    for b in _BANDS:
        if b["min_years"] <= age <= b["max_years"]:
            return b["band"]
    return _BANDS[-1]["band"]


def feature_columns() -> list[str]:
    cols: list[str] = list(_NUMERIC) + list(_MISSING)
    cols += [f"sex_{c}" for c in _SEX_CATS]
    cols += [f"band_{c}" for c in _BAND_CATS]
    cols += [f"region_{r}" for r in _REGIONS]
    cols += [f"sym_{s}" for s in _SYMPTOMS]
    cols += [f"risk_{r}" for r in _RISKS]
    return cols


def expand(record: dict[str, Any]) -> OrderedDict:
    vitals = record.get("vitals") or {}
    symptoms = record.get("symptoms") or []
    regions = set(record.get("regions") or [])
    risks = set(record.get("risk_factors") or [])
    present = {s["code"] for s in symptoms}
    age = record.get("age")

    row: OrderedDict = OrderedDict()

    # numeric
    row["age"] = float(age) if age is not None else _AGE_FILL
    row["severity_max"] = float(max((s.get("severity", 0) for s in symptoms), default=0))
    row["duration_hours"] = float(max((s.get("duration_hours") or 0 for s in symptoms), default=0))
    for v in _VITALS:
        val = vitals.get(v)
        row[v] = float(val) if val is not None else _VITAL_FILL[v]

    # missing indicators (vitals only)
    for m in _MISSING:
        vital = m.rsplit("_missing", 1)[0]
        row[m] = 1 if vitals.get(vital) is None else 0

    # categoricals (one-hot)
    sex = record.get("sex") if record.get("sex") in _SEX_CATS else "unknown"
    for c in _SEX_CATS:
        row[f"sex_{c}"] = 1 if c == sex else 0
    band = resolve_band(age)
    for c in _BAND_CATS:
        row[f"band_{c}"] = 1 if c == band else 0

    # multi-hot
    for r in _REGIONS:
        row[f"region_{r}"] = 1 if r in regions else 0
    for s in _SYMPTOMS:
        row[f"sym_{s}"] = 1 if s in present else 0
    for r in _RISKS:
        row[f"risk_{r}"] = 1 if r in risks else 0

    return row


def build_frame(records: list[dict]) -> pd.DataFrame:
    """Expand many records into a DataFrame with the canonical column order."""
    return pd.DataFrame([expand(r) for r in records], columns=feature_columns())
