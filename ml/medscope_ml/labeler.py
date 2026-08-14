"""Label assignment for synthetic cases.

Red-flag rows are labeled deterministically by the SAME redflags.table.json the
runtime engine uses (parity is cross-checked in tests). Non-red-flag rows get a
synthetic urgency from a documented risk score plus ASYMMETRIC noise: noise may
only move a label among the non-emergency classes, never flip a true emergency
down. This keeps the synthetic distribution intentionally safety-biased.
"""
from __future__ import annotations

import random

from triage_shared import UrgencyLevel, escalate, red_flag_table

_TABLE = red_flag_table()
_VITALS_RULES = _TABLE["vitals_rules"]
_SYMPTOM_RULES = _TABLE["symptom_rules"]
_BANDS = _TABLE["age_bands"]

_OPS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
}


def resolve_band(age: int | None) -> str | None:
    if age is None:
        return None
    for b in _BANDS:
        if b["min_years"] <= age <= b["max_years"]:
            return b["band"]
    return _BANDS[-1]["band"]


def _threshold(rule: dict, band: str | None) -> float:
    th = rule["thresholds"]
    if band and band in th:
        return th[band]
    vals = list(th.values())
    return min(vals) if rule["op"] in (">", ">=") else max(vals)


def _vitals_fire(record, band) -> UrgencyLevel | None:
    vitals = record.get("vitals") or {}
    out = None
    for rule in _VITALS_RULES:
        val = vitals.get(rule["vital"])
        if val is None:
            continue
        if _OPS[rule["op"]](val, _threshold(rule, band)):
            u = UrgencyLevel(rule["urgency"])
            out = u if out is None else escalate(out, u)
    return out


def _symptom_fire(record, band) -> UrgencyLevel | None:
    symptoms = record.get("symptoms") or []
    present = {s["code"] for s in symptoms}
    severity = {s["code"]: s.get("severity", 0) for s in symptoms}
    regions = set(record.get("regions") or [])
    risks = set(record.get("risk_factors") or [])
    vitals = record.get("vitals") or {}
    out = None
    for rule in _SYMPTOM_RULES:
        if _matches(rule["when"], band, present, severity, regions, risks, vitals):
            u = UrgencyLevel(rule["urgency"])
            out = u if out is None else escalate(out, u)
    return out


def _matches(when, band, present, severity, regions, risks, vitals) -> bool:
    if "age_band" in when and band not in when["age_band"]:
        return False
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
    if "severity_ge" in when and candidates:
        sg = when["severity_ge"]
        thresh = sg.get(band, sg.get("default"))
        if thresh is not None and max(severity.get(c, 0) for c in candidates) < thresh:
            return False
    if "vital_ge" in when:
        for v, val in when["vital_ge"].items():
            cur = vitals.get(v)
            if cur is None or cur < val:
                return False
    if "any_vital" in when and not _any_vital(when["any_vital"], vitals):
        return False
    if "any_of" in when:
        ao = when["any_of"]
        if not (any(r in regions for r in ao.get("regions", []))
                or any(r in risks for r in ao.get("risk_factors", []))):
            return False
    return True


def _any_vital(conds, vitals) -> bool:
    checks = {"hr_gt": ("hr", ">"), "hr_lt": ("hr", "<"), "rr_gt": ("rr", ">"),
              "spo2_lt": ("spo2", "<"), "sbp_lt": ("sbp", "<"), "temp_ge": ("temp_c", ">=")}
    for key, threshold in conds.items():
        if key not in checks:
            continue
        vital, op = checks[key]
        cur = vitals.get(vital)
        if cur is not None and _OPS[op](cur, threshold):
            return True
    return False


def red_flag_urgency(record: dict) -> UrgencyLevel | None:
    band = resolve_band(record.get("age"))
    v = _vitals_fire(record, band)
    s = _symptom_fire(record, band)
    if v is None and s is None:
        return None
    if v is None:
        return s
    if s is None:
        return v
    return escalate(v, s)


def _risk_score(record) -> float:
    """Continuous non-red-flag risk driver in [0, ~1.5]."""
    symptoms = record.get("symptoms") or []
    sev = max((s.get("severity", 0) for s in symptoms), default=0)
    score = 0.10 * sev + 0.15 * len(symptoms) + 0.20 * len(record.get("risk_factors") or [])
    vitals = record.get("vitals") or {}
    # mild (sub-threshold) vitals abnormality nudges risk up
    if vitals.get("spo2") is not None and vitals["spo2"] < 95:
        score += 0.3
    if vitals.get("hr") is not None and vitals["hr"] > 100:
        score += 0.2
    if vitals.get("temp_c") is not None and vitals["temp_c"] >= 37.8:
        score += 0.2
    band = resolve_band(record.get("age"))
    if band in {"infant", "child", "older_adult"}:
        score += 0.15
    return score


def _nonredflag_urgency(record, rng: random.Random) -> UrgencyLevel:
    score = _risk_score(record)
    # asymmetric noise on the non-emergency side only
    score += rng.gauss(0, 0.15)
    if score >= 0.9:
        return UrgencyLevel.URGENT_TODAY
    if score >= 0.5:
        return UrgencyLevel.DOCTOR_SOON
    if score >= 0.2:
        return UrgencyLevel.ROUTINE
    return UrgencyLevel.SELF_CARE


def label_record(record: dict, rng: random.Random) -> tuple[str, str]:
    """Return (urgency_value, label_source in {'rule','sampled'})."""
    rf = red_flag_urgency(record)
    if rf is not None:
        return rf.value, "rule"
    return _nonredflag_urgency(record, rng).value, "sampled"
