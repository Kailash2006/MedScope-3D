"""Executable red-flag rules, driven entirely by the shared redflags.table.json.

Each fired rule yields a Fire(rule_id, urgency, message). The engine merges them
escalate-only. Rules never downgrade; a missing input can only fail to fire a
rule, never produce a reassuring result.
"""
from __future__ import annotations

from dataclasses import dataclass

from triage_shared import UrgencyLevel, red_flag_table

from .models import TriageInput

_TABLE = red_flag_table()
_VITALS_RULES = _TABLE["vitals_rules"]
_SYMPTOM_RULES = _TABLE["symptom_rules"]

_OPS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
}


@dataclass(frozen=True)
class Fire:
    rule_id: str
    urgency: UrgencyLevel
    message: str
    source: str  # "vitals" | "symptom"


def _threshold_for(rule: dict, band: str | None) -> float:
    """Resolve a vitals threshold for the band, or the most-sensitive threshold
    across all bands when the band is unknown (conservative for missing age)."""
    thresholds = rule["thresholds"]
    if band is not None and band in thresholds:
        return thresholds[band]
    values = list(thresholds.values())
    # '>'/'>=' fire when value exceeds threshold -> lowest threshold is most sensitive.
    # '<'/'<=' fire when value is below threshold -> highest threshold is most sensitive.
    return min(values) if rule["op"] in (">", ">=") else max(values)


def evaluate_vitals(inp: TriageInput, band: str | None) -> list[Fire]:
    fires: list[Fire] = []
    vitals = inp.vitals.model_dump()
    for rule in _VITALS_RULES:
        value = vitals.get(rule["vital"])
        if value is None:
            continue  # missing vital: cannot fire, never treated as normal
        threshold = _threshold_for(rule, band)
        if _OPS[rule["op"]](value, threshold):
            fires.append(
                Fire(rule["id"], UrgencyLevel(rule["urgency"]), rule["message"], "vitals")
            )
    return fires


def evaluate_symptoms(inp: TriageInput, band: str | None) -> list[Fire]:
    present = {s.code for s in inp.symptoms}
    severity = {s.code: s.severity for s in inp.symptoms}
    regions = set(inp.regions)
    risks = set(inp.risk_factors)
    vitals = inp.vitals.model_dump()

    fires: list[Fire] = []
    for rule in _SYMPTOM_RULES:
        if _symptom_rule_matches(rule["when"], band, present, severity, regions, risks, vitals):
            fires.append(
                Fire(rule["id"], UrgencyLevel(rule["urgency"]), rule["message"], "symptom")
            )
    return fires


def _symptom_rule_matches(
    when: dict,
    band: str | None,
    present: set[str],
    severity: dict[str, int],
    regions: set[str],
    risks: set[str],
    vitals: dict,
) -> bool:
    # age_band restriction
    if "age_band" in when and band not in when["age_band"]:
        return False

    # Determine the candidate symptoms this rule keys off (for severity checks).
    candidates: list[str] = []
    if "symptom" in when:
        if when["symptom"] not in present:
            return False
        candidates = [when["symptom"]]
    if "any_symptom" in when:
        matched = [c for c in when["any_symptom"] if c in present]
        if not matched:
            return False
        candidates += matched
    if "all_symptoms" in when:
        if not all(c in present for c in when["all_symptoms"]):
            return False
        candidates += list(when["all_symptoms"])

    # severity threshold (band-aware, falls back to "default")
    if "severity_ge" in when and candidates:
        sg = when["severity_ge"]
        thresh = sg.get(band, sg.get("default"))
        if thresh is not None and max(severity.get(c, 0) for c in candidates) < thresh:
            return False

    # vital_ge: every listed vital must be present AND >= its value
    if "vital_ge" in when:
        for v, val in when["vital_ge"].items():
            cur = vitals.get(v)
            if cur is None or cur < val:
                return False

    # any_vital: at least one of the listed conditions must hold (present vital)
    if "any_vital" in when and not _any_vital(when["any_vital"], vitals):
        return False

    # any_of: at least one listed region OR risk factor present
    if "any_of" in when:
        ao = when["any_of"]
        ok = any(r in regions for r in ao.get("regions", [])) or any(
            r in risks for r in ao.get("risk_factors", [])
        )
        if not ok:
            return False

    return True


def _any_vital(conds: dict, vitals: dict) -> bool:
    checks = {
        "hr_gt": ("hr", ">"),
        "hr_lt": ("hr", "<"),
        "rr_gt": ("rr", ">"),
        "spo2_lt": ("spo2", "<"),
        "sbp_lt": ("sbp", "<"),
        "temp_ge": ("temp_c", ">="),
    }
    for key, threshold in conds.items():
        if key not in checks:
            continue
        vital, op = checks[key]
        cur = vitals.get(vital)
        if cur is not None and _OPS[op](cur, threshold):
            return True
    return False
