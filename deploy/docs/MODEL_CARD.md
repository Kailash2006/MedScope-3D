# MedScope 3D — Model Card

> Status: **placeholder** (Phase 0). Populated with real metrics in Phase 2 when
> the first model artifact is trained. This file is committed now so the
> Threshold Provenance section (required, CI-checked to exist) travels with the repo.

## Intended use

Educational/research demonstration of **urgency triage** (which of six levels of
care urgency a case suggests). **Not** a diagnostic tool. Outputs urgency guidance
only — never a disease diagnosis or medication recommendation.

## Out of scope / prohibited

- Real clinical decision-making
- Any use implying HIPAA compliance
- Diagnosis or treatment recommendation

## Data

Baseline uses a **documented synthetic dataset** (rule-seeded + asymmetric noise),
intentionally safety-biased toward emergency/urgent cases. See `ml/data/`.
No real patient data. Real data can drop into the same schema later.

## Threshold Provenance

The red-flag thresholds in this system — including the age-banded vitals cut-offs
in `packages/triage-shared/schema/redflags.table.json` — are **simplified
triage-education defaults, not validated clinical cut-offs.** Some values are
deliberately conservative or coarse (e.g. infant HR-low < 90, older-adult
SpO₂ < 92) and would not match any specific clinical scoring system
(PEWS, NEWS2, APLS, etc.). They exist to make a research/education prototype
behave safely, not to guide real care. Every row in the rule table carries
`provenance: "education-default"`, and this caveat is surfaced in the UI
disclaimer and PDF report footer so it travels with every output.

## Metrics (Phase 2 — model v1.0.0, local CPU run)

Chosen model: **XGBoost** (isotonic-calibrated), 60,000 synthetic rows (seed 42),
EMERGENCY-upweighted training + asymmetric EMERGENCY decision threshold τ≈0.35.

- Macro-F1: **0.744**   Balanced accuracy: 0.739   Brier (mean OvR): **0.046**
- **Emergency recall: 0.990 — gate ≥ 0.98: PASS** (45 of ~4,471 test emergencies
  under-triaged by ML; all are red-flag cases the rule engine catches in production)
- EMERGENCY class: precision 0.96 / recall 0.99 / F1 0.975
- Under-triage rate (overall): 0.072
- Logistic Regression baseline cannot meet the emergency gate without collapsing
  its other-class precision — this is why XGBoost is the shipped model.

Numbers above are the local proof run. The Kaggle 2×GPU notebook
(`ml/notebooks/medscope_kaggle_train.ipynb`) retrains on ~300k rows across both
GPUs and enforces the same gate; update this section with that run's metrics.json
when it is used to produce the released artifact.

> These metrics are on **synthetic, rule-seeded data** and do not represent
> clinical performance.

## Metrics (REAL data — model real-v1.1.0, Kaggle GPU run)

Trained on the **real Yale EMMLC ED triage dataset** (`maalona/hospital-triage-and-
patient-history-data`): **560,486 de-identified ED visits**, ESI acuity label +
triage vitals + 200 chief-complaint columns + arrival/prior-visit history. No
synthetic data. Script: `ml/notebooks/kaggle_real_train.py`.

Pipeline: `ESI 1+2 → EMERGENCY` (standard high-acuity merge), `3 → URGENT_TODAY`,
`4 → DOCTOR_SOON`, `5 → ROUTINE` (SELF_CARE not applicable — all rows are ED
visits). 287 features (vitals + chief complaints + arrival/history; protected
attributes and post-visit/leakage columns deliberately excluded). Calibrated
XGBoost (900 trees, depth 10) on GPU; 558,029 rows after dropping missing ESI.

- **Macro-F1: 0.675** (4 classes)   Brier (mean OvR): **0.099**   Under-triage: 0.109
- **EMERGENCY: precision 0.68 / recall 0.84 / F1 0.75** (support 25,321)
- URGENT_TODAY F1 0.68 · DOCTOR_SOON F1 0.71 · ROUTINE F1 0.56
- Emergency decision threshold τ=0.50 (argmax — EMERGENCY is a ~30% class, no hack needed)

**Honest notes:**
- This is a **real, honest** result — much harder than the circular synthetic
  0.744. The 0.675 is over **4 classes** (ESI 1+2 merged), so it is *not* directly
  comparable to the 5-class synthetic number.
- **Not clinically validated.** ESI labels carry inter-rater variability; the
  ESI→urgency mapping is a defensible convention, not a clinical standard.
- **Serving mismatch:** this model expects 287 columns (incl. 200 chief-complaint
  flags + history). The app collects far fewer inputs, so it cannot be served
  as-is by the current UI without either a richer input form or a smaller model
  trained on app-collectable features only. Tracked as future work.

## Fallback behavior

Low confidence, missing required fields, model load/predict error, or severe
vitals route to a conservative fallback that never sits below what the red-flag
rules imply. Recorded in `decision_path`.

## Versioning

Every assessment records `model_version` and `engine_version`. Model artifacts are
tracked in the `model_registry` table.
