"""The emergency-recall release gate must hold for the chosen (xgboost) model.

Trains a small, fast model deterministically and asserts the gate passes. This is
the CI guard that a retrain cannot ship while under-triaging emergencies.
"""
from pathlib import Path

import yaml

from medscope_ml.train import train

CFG = yaml.safe_load((Path(__file__).resolve().parents[1] / "config.yaml").read_text())


def test_emergency_recall_gate_passes_for_xgboost():
    result = train(CFG, n_rows=15000, n_estimators=200, calibrate=False, model_choice="xgboost")
    safety = result["artifact"]["safety"]
    assert safety["gate_passed"] is True, safety
    assert safety["emergency_recall"] >= CFG["evaluation"]["emergency_recall_min"], safety


def test_artifact_has_serving_contract():
    result = train(CFG, n_rows=8000, n_estimators=120, calibrate=False, model_choice="xgboost")
    a = result["artifact"]
    assert a["feature_columns"], "must store feature columns for skew guard"
    assert 0.05 <= a["emergency_threshold"] <= 0.5
    assert a["classes"] and "EMERGENCY" in a["classes"]
