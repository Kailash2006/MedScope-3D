"""NL symptom extraction: lexicon, negation, severity/duration, vitals, endpoint."""
from __future__ import annotations

from app.nlp.extract import extract


def test_stroke_triad_extracted():
    r = extract("slurred speech and weakness on one side, face is drooping")
    codes = {s["code"] for s in r["symptoms"]}
    assert {"facial_droop", "unilateral_weakness", "speech_difficulty"} <= codes


def test_cardiac_pattern_with_risks_and_region():
    r = extract("crushing chest pain radiating to my left arm, I'm a smoker with high blood pressure")
    assert any(s["code"] == "chest_pain" for s in r["symptoms"])
    assert "arm_left" in r["regions"]
    assert "smoker" in r["risk_factors"] and "hypertension" in r["risk_factors"]


def test_negation_suppresses_symptom():
    r = extract("throwing up for 2 days, no fever")
    codes = {s["code"] for s in r["symptoms"]}
    assert "vomiting" in codes
    assert "fever" not in codes


def test_severity_and_duration_parsed():
    r = extract("severe headache for 3 hours")
    h = next(s for s in r["symptoms"] if s["code"] == "headache")
    assert h["severity"] >= 8
    assert h["duration_hours"] == 3.0


def test_vitals_and_bp_parsed():
    r = extract("spo2 88, hr 120, temp 39.2, bp 90/60")
    v = r["vitals"]
    assert v["spo2"] == 88 and v["hr"] == 120 and v["temp_c"] == 39.2
    assert v["sbp"] == 90 and v["dbp"] == 60


def test_endpoint_returns_structured(client):
    res = client.post("/api/v1/nlp/extract", json={"text": "bad headache and stiff neck, feverish"})
    assert res.status_code == 200
    body = res.json()
    codes = {s["code"] for s in body["symptoms"]}
    assert {"headache", "neck_stiffness", "fever"} <= codes


def test_endpoint_rejects_empty(client):
    assert client.post("/api/v1/nlp/extract", json={"text": ""}).status_code == 422
