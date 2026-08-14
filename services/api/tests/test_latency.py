"""Rule-path latency: p95 < 50ms locally (Phase 1 target)."""
import time

from app.triage import SymptomEntry, TriageInput, Vitals, assess


def _mk(**kw) -> TriageInput:
    vitals = Vitals(**kw.pop("vitals", {}))
    symptoms = [SymptomEntry(**s) for s in kw.pop("symptoms", [])]
    return TriageInput(vitals=vitals, symptoms=symptoms, **kw)


def test_rule_path_p95_under_50ms():
    inp = _mk(age=61, sex="M", regions=["chest_left", "arm_left"],
              symptoms=[{"code": "chest_pain", "severity": 8},
                        {"code": "difficulty_breathing", "severity": 4}],
              risk_factors=["hypertension", "smoker"],
              vitals={"hr": 128, "sbp": 95, "spo2": 94, "temp_c": 37.4, "rr": 22})

    # warmup (module/table already imported, but be explicit)
    for _ in range(10):
        assess(inp)

    samples = []
    for _ in range(500):
        t0 = time.perf_counter()
        assess(inp)
        samples.append((time.perf_counter() - t0) * 1000.0)

    samples.sort()
    p95 = samples[int(0.95 * len(samples)) - 1]
    assert p95 < 50.0, f"p95={p95:.3f}ms exceeds 50ms budget"
