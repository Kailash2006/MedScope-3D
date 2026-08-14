"""Generator/engine parity: the labeler's red-flag determination must match the
Phase 1 API triage engine (both consume the same redflags.table.json). This is
the guard against the dataset and the runtime drifting apart.
"""
import random
import sys
from pathlib import Path

import pytest

# Make the API package importable (monorepo sibling).
API_DIR = Path(__file__).resolve().parents[2] / "services" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

engine = pytest.importorskip("app.triage")

from medscope_ml.generate import sample_record
from medscope_ml.labeler import red_flag_urgency

RED_FLAG_PATHS = {"VITALS_RED_FLAG", "SYMPTOM_RED_FLAG"}


def _to_input(rec: dict):
    return engine.TriageInput(
        age=rec.get("age"), sex=rec.get("sex"),
        regions=rec.get("regions", []),
        symptoms=[engine.SymptomEntry(**s) for s in rec.get("symptoms", [])],
        risk_factors=rec.get("risk_factors", []),
        vitals=engine.Vitals(**(rec.get("vitals") or {})),
    )


def test_labeler_matches_engine_on_redflags():
    rng = random.Random(123)
    checked_redflag = 0
    for _ in range(1500):
        rec = sample_record(rng, target_fraction=0.5)
        result = engine.assess(_to_input(rec))
        lab = red_flag_urgency(rec)
        if result.decision_path in RED_FLAG_PATHS:
            checked_redflag += 1
            assert lab is not None, rec
            assert lab.value == result.urgency, (result.decision_path, result.urgency, rec)
        else:
            # engine found no red flag -> labeler must agree there is none
            assert lab is None, (result.decision_path, rec)
    assert checked_redflag > 100  # ensure we actually exercised red-flag cases
