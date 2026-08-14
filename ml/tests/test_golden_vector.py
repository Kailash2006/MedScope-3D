"""Golden-vector + serving-parity guards (Addendum B).

1. Feature expansion is deterministic and stable for a fixed record (catches
   silent feature-contract drift between training and serving).
2. A trained model + predict() classifies an obvious hypoxia case as EMERGENCY.
"""
from pathlib import Path

import yaml

from medscope_ml import features as F
from medscope_ml.predict import predict
from medscope_ml.train import train

CFG = yaml.safe_load((Path(__file__).resolve().parents[1] / "config.yaml").read_text())

GOLDEN_RECORD = {
    "age": 61, "sex": "M", "regions": ["chest_left"],
    "symptoms": [{"code": "chest_pain", "severity": 6, "duration_hours": 2}],
    "risk_factors": ["hypertension"],
    "vitals": {"hr": 92, "sbp": 128, "dbp": 82, "spo2": 96, "temp_c": 37.1, "rr": 18},
}


def test_feature_expansion_is_deterministic():
    a = F.expand(GOLDEN_RECORD)
    b = F.expand(dict(GOLDEN_RECORD))
    assert a == b
    # column set is exactly the declared contract, in order
    assert list(a.keys()) == F.feature_columns()


def test_missing_vital_sets_indicator_and_fill():
    rec = {"age": 40, "symptoms": [{"code": "headache", "severity": 3}], "vitals": {}}
    row = F.expand(rec)
    assert row["spo2_missing"] == 1
    assert row["spo2"] == 98.0  # assume-normal fill, flagged by the indicator


def test_trained_model_flags_hypoxia_emergency():
    result = train(CFG, n_rows=12000, n_estimators=150, calibrate=False, model_choice="xgboost")
    artifact = result["artifact"]
    hypoxia = {"age": 40, "sex": "M", "vitals": {"spo2": 84}}
    out = predict(artifact, hypoxia)
    assert out["urgency"] == "EMERGENCY", out
    assert out["proba"]["EMERGENCY"] > 0.5
