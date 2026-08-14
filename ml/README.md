# MedScope ML pipeline (Phase 2)

Offline pipeline: **synthetic dataset → train (LR + XGBoost) → evaluate (with an
EMERGENCY-recall safety gate) → artifacts**. Serving-side prediction reuses the
same feature builder to prevent training/serving skew.

> ⚠️ Data is **synthetic and rule-seeded** — accuracy here is not clinical
> accuracy. See `../deploy/docs/MODEL_CARD.md`.

## Layout

```
medscope_ml/
  features.py     one place a case becomes a model vector (skew guard)
  labeler.py      applies the shared red-flag table + synthetic scoring (asymmetric noise)
  generate.py     safety-biased synthetic dataset generator
  train.py        LR + XGBoost, isotonic calibration, EMERGENCY decision threshold
  metrics.py      macro-F1, per-class, calibration (Brier)
  safety_eval.py  EMERGENCY-recall gate + under-triage reporting
  predict.py      serving-side predictor (ML half of the Phase 3 PredictionService)
config.yaml       dataset size, seed, model + safety knobs
notebooks/medscope_kaggle_train.ipynb   multi-GPU (Dask-CUDA + xgboost.dask)
artifacts/        model_<ver>.joblib (gitignored) + metrics.json + metrics_summary.md
tests/            dataset schema, eval gate, golden vector, generator/engine parity
```

## Run locally (CPU)

```bash
pip install -e ./packages/triage-shared/python -e ./ml
python -m medscope_ml.generate            # writes ml/data/generated/dataset.parquet
python -m medscope_ml.train               # trains, evaluates, writes artifacts
pytest ml/tests -q
```

CLI overrides: `--n-rows`, `--n-estimators`, `--model {xgboost,logreg}`, `--no-calibrate`.

## Multi-GPU (Kaggle, 2× GPU)

Open `notebooks/medscope_kaggle_train.ipynb`, set Accelerator to **GPU T4 ×2**,
point it at the repo (GitHub clone or Kaggle Dataset), and run. It builds a
**Dask-CUDA cluster with one worker per GPU** and trains with `xgboost.dask`
across all visible GPUs on a larger dataset (default 300k rows), enforces the
same EMERGENCY-recall gate, and saves a serving-compatible artifact.

## Safety design

- **EMERGENCY-recall gate** (`emergency_recall_min`, default 0.98) blocks release
  if the model under-triages emergencies. Enforced in `tests/test_eval_gate.py`.
- **EMERGENCY-upweighted samples** + an **asymmetric decision threshold**
  (predict EMERGENCY when `P(EMERGENCY) ≥ τ`, τ tuned on validation) keep recall
  high. τ is stored in the artifact and applied at serving time.
- **Skew guard:** `predict.py` asserts the artifact's feature columns match
  `features.feature_columns()`; a mismatch raises so the caller fails safe.
- **Defense in depth:** the deterministic rule engine (Phase 1) still runs before
  ML in production, so any ML emergency miss is backstopped by the rules.
