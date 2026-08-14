"""Cross-language parity: Python enums must match the canonical JSON, and the
Python-visible values must match what the TS package exports."""
from triage_shared import (
    UrgencyLevel,
    URGENCY_LEVELS,
    escalate,
    rank_of,
    INSUFFICIENT_INFO,
)
from triage_shared.reasons import DECISION_PATHS, REASON_TYPES
from triage_shared.tables import load_schema


def test_urgency_enum_matches_json_order():
    canonical = [lvl["value"] for lvl in load_schema("urgency.json")["levels"]]
    assert URGENCY_LEVELS == canonical
    assert [e.value for e in UrgencyLevel] == canonical


def test_decision_path_enum_matches_json():
    assert DECISION_PATHS == load_schema("reasons.schema.json")["decision_path"]["enum"]
    assert REASON_TYPES == load_schema("reasons.schema.json")["reason_type"]["enum"]


def test_escalate_never_downgrades():
    assert escalate(UrgencyLevel.ROUTINE, UrgencyLevel.EMERGENCY) == UrgencyLevel.EMERGENCY
    assert escalate(UrgencyLevel.EMERGENCY, UrgencyLevel.SELF_CARE) == UrgencyLevel.EMERGENCY


def test_insufficient_info_never_wins():
    assert rank_of(INSUFFICIENT_INFO) == 0
    assert escalate(UrgencyLevel.SELF_CARE, INSUFFICIENT_INFO) == UrgencyLevel.SELF_CARE


def test_redflag_table_is_education_default():
    table = load_schema("redflags.table.json")
    assert table["provenance"] == "education-default"
    # every banded vitals rule must cover all five age bands
    bands = {b["band"] for b in table["age_bands"]}
    for rule in table["vitals_rules"]:
        assert bands.issubset(set(rule["thresholds"].keys())), rule["id"]
