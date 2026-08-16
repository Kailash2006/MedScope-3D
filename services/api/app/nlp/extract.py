"""Natural-language symptom extraction (no external deps, no API keys).

Turns free text like "bad headache and a stiff neck since this morning, feels
feverish" into the app's structured triage schema: symptoms (with severity +
duration), regions, risk factors, and vitals. A synonym lexicon + stdlib fuzzy
matching (difflib) + negation handling keeps it tiny and CPU-only, so it runs on
the free backend. Deterministic and testable; the ML model still governs urgency.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

# --- lexicons: code -> trigger phrases (order doesn't matter) ---
SYMPTOM_PHRASES: dict[str, list[str]] = {
    "chest_pain": ["chest pain", "chest tightness", "chest pressure", "tight chest", "pain in my chest", "chest ache", "angina"],
    "difficulty_breathing": ["difficulty breathing", "shortness of breath", "short of breath", "can't breathe", "cant breathe", "hard to breathe", "breathless", "wheezing", "gasping", "sob", "dyspnea"],
    "abdominal_pain": ["abdominal pain", "stomach pain", "stomach ache", "stomachache", "belly pain", "tummy pain", "cramps", "gut pain", "belly hurts", "stomach hurts", "tummy hurts", "belly ache"],
    "headache": ["headache", "head ache", "migraine", "head pain", "pounding head", "splitting headache"],
    "fever": ["fever", "feverish", "high temperature", "hot and sweaty", "running a temperature", "febrile", "chills"],
    "vomiting": ["vomiting", "throwing up", "throw up", "puking", "being sick", "nausea", "nauseous", "queasy"],
    "facial_droop": ["facial droop", "face drooping", "drooping face", "one side of my face", "face is drooping", "crooked smile"],
    "unilateral_weakness": ["weakness on one side", "one side weak", "arm weakness", "leg weakness", "can't move my", "cant move my", "numbness on one side", "hemiparesis", "one sided weakness"],
    "speech_difficulty": ["slurred speech", "trouble speaking", "difficulty speaking", "can't speak", "cant speak", "words won't come", "speech is slurred", "aphasia"],
    "swelling": ["swelling", "swollen", "puffy", "inflamed", "edema"],
    "neck_stiffness": ["stiff neck", "neck stiffness", "stiffness in my neck", "can't move my neck", "cant move my neck", "rigid neck"],
}

RISK_PHRASES: dict[str, list[str]] = {
    "hypertension": ["hypertension", "high blood pressure", "high bp", "htn"],
    "smoker": ["smoker", "i smoke", "smoking", "tobacco", "vape", "vaping"],
    "diabetes": ["diabetes", "diabetic", "type 2 diabetes", "type 1 diabetes", "sugar problem"],
    "pregnancy": ["pregnant", "pregnancy", "expecting", "weeks pregnant"],
    "known_allergen_exposure": ["allergic reaction", "allergen", "anaphylaxis", "ate a peanut", "bee sting", "exposed to allergen", "known allergy"],
}

REGION_PHRASES: dict[str, list[str]] = {
    "head": ["head", "skull", "forehead"],
    "jaw": ["jaw", "jawline"],
    "chest_left": ["left chest", "chest left", "left side of my chest"],
    "chest_right": ["right chest", "chest right", "right side of my chest"],
    "abdomen": ["abdomen", "belly", "stomach", "tummy", "gut"],
    "back": ["back", "spine", "lower back", "upper back"],
    "arm_left": ["left arm"],
    "arm_right": ["right arm"],
    "leg_left": ["left leg"],
    "leg_right": ["right leg"],
}

SEVERITY_WORDS = {
    "mild": 3, "slight": 3, "minor": 3, "a bit": 3,
    "moderate": 5, "medium": 5, "noticeable": 5,
    "bad": 7, "strong": 7, "terrible": 8, "crushing": 9, "severe": 8, "intense": 8, "really bad": 8, "very bad": 8,
    "excruciating": 10, "unbearable": 10, "worst": 10, "10/10": 10,
}

_NEG = re.compile(r"\b(no|not|without|never|deny|denies|denied|negative for|free of)\b")
_VITALS = {
    "hr": r"(?:hr|heart rate|pulse)\D{0,6}(\d{2,3})",
    "spo2": r"(?:spo2|sats?|oxygen|o2)\D{0,6}(\d{2,3})",
    "temp_c": r"(?:temp(?:erature)?)\D{0,6}(\d{2,3}(?:\.\d)?)",
    "rr": r"(?:rr|resp(?:iratory)? rate|breathing rate)\D{0,6}(\d{1,2})",
}
_BP = re.compile(r"\b(?:bp\s*(?:is|of)?\s*)?(\d{2,3})\s*/\s*(\d{2,3})\b")


def _norm(t: str) -> str:
    return re.sub(r"\s+", " ", t.lower()).strip()


def _fuzzy_present(phrase: str, text: str) -> bool:
    """True if `phrase` appears in `text` exactly, or a close (typo-tolerant) match
    exists over a same-length window (single-token phrases only, to avoid noise)."""
    if phrase in text:
        return True
    if " " in phrase:
        return False
    for tok in re.findall(r"[a-z']+", text):
        if len(tok) >= 4 and SequenceMatcher(None, tok, phrase).ratio() >= 0.86:
            return True
    return False


def _matched(text: str, phrases: list[str]) -> str | None:
    """Return the matched phrase (for negation window checks), or None."""
    for p in phrases:
        if _fuzzy_present(p, text):
            return p
    return None


def _is_negated(text: str, phrase: str) -> bool:
    idx = text.find(phrase.split()[0])
    if idx < 0:
        return False
    window = text[max(0, idx - 24):idx]
    return bool(_NEG.search(window))


def _severity(text: str, default: int = 5) -> int:
    m = re.search(r"\b(\d{1,2})\s*/\s*10\b", text)
    if m:
        return max(0, min(10, int(m.group(1))))
    best = None
    for word, val in SEVERITY_WORDS.items():
        if word in text:
            best = val if best is None else max(best, val)
    return best if best is not None else default


def _duration_hours(text: str) -> float | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(hour|hr|day|week|min|minute)s?", text)
    if m:
        n, unit = float(m.group(1)), m.group(2)
        return {"min": n / 60, "minute": n / 60, "hour": n, "hr": n, "day": n * 24, "week": n * 168}[unit]
    if "since this morning" in text or "this morning" in text:
        return 6.0
    if "since last night" in text or "overnight" in text:
        return 10.0
    if "yesterday" in text:
        return 24.0
    if "few days" in text or "couple of days" in text:
        return 60.0
    return None


def extract(text: str) -> dict:
    """Free text -> structured triage record (same shape the API/reducer expect)."""
    t = _norm(text)
    dur = _duration_hours(t)
    sev = _severity(t)

    symptoms = []
    for code, phrases in SYMPTOM_PHRASES.items():
        hit = _matched(t, phrases)
        if hit and not _is_negated(t, hit):
            symptoms.append({"code": code, "severity": sev, "duration_hours": dur})

    regions = [c for c, ph in REGION_PHRASES.items() if (m := _matched(t, ph)) and not _is_negated(t, m)]
    risk_factors = [c for c, ph in RISK_PHRASES.items() if (m := _matched(t, ph)) and not _is_negated(t, m)]

    vitals: dict[str, float] = {}
    for key, pat in _VITALS.items():
        m = re.search(pat, t)
        if m:
            vitals[key] = float(m.group(1))
    bp = _BP.search(t)
    if bp:
        vitals.setdefault("sbp", float(bp.group(1)))
        vitals.setdefault("dbp", float(bp.group(2)))

    return {
        "symptoms": symptoms,
        "regions": regions,
        "risk_factors": risk_factors,
        "vitals": vitals,
        "detected": {
            "severity": sev,
            "duration_hours": dur,
            "count": len(symptoms) + len(regions) + len(risk_factors) + len(vitals),
        },
    }
