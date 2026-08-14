"""Full assess() latency WITH the ML model loaded: p95 < 500ms (Phase 3 target)."""
import time

from app.ml.prediction_service import PredictionService
from app.triage import SymptomEntry, TriageInput, Vitals, assess


def test_assess_with_ml_p95_under_500ms(tmp_artifact):
    predictor = PredictionService.from_dir(tmp_artifact)
    assert predictor.ready

    inp = TriageInput(
        age=55, sex="M", regions=["chest_left"],
        symptoms=[SymptomEntry(code="chest_pain", severity=5, duration_hours=3)],
        risk_factors=["hypertension"],
        vitals=Vitals(hr=98, sbp=128, dbp=82, spo2=96, temp_c=37.2, rr=18),
    )
    for _ in range(10):
        assess(inp, predictor)  # warmup

    samples = []
    for _ in range(200):
        t0 = time.perf_counter()
        assess(inp, predictor)
        samples.append((time.perf_counter() - t0) * 1000.0)
    samples.sort()
    p95 = samples[int(0.95 * len(samples)) - 1]
    assert p95 < 500.0, f"p95={p95:.2f}ms exceeds 500ms budget"
