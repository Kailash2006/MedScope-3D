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

## Metrics (to be filled in Phase 2)

- Macro-F1: _tbd_
- **Emergency recall (release gate ≥ 0.98): _tbd_**
- Under-triage rate by class: _tbd_
- Calibration (Brier): _tbd_
- Low-confidence fallback coverage: _tbd_

## Fallback behavior

Low confidence, missing required fields, model load/predict error, or severe
vitals route to a conservative fallback that never sits below what the red-flag
rules imply. Recorded in `decision_path`.

## Versioning

Every assessment records `model_version` and `engine_version`. Model artifacts are
tracked in the `model_registry` table.
