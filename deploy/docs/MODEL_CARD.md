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

## Fallback behavior

Low confidence, missing required fields, model load/predict error, or severe
vitals route to a conservative fallback that never sits below what the red-flag
rules imply. Recorded in `decision_path`.

## Versioning

Every assessment records `model_version` and `engine_version`. Model artifacts are
tracked in the `model_registry` table.
