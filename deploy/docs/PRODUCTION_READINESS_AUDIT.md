# MedScope 3D — Production Readiness Audit

> **Read-only audit.** No source, model, thresholds, or architecture were changed
> to produce this report. Findings are drawn directly from the repository as it
> stands. Metrics that cannot be recomputed from the repo are flagged explicitly
> with what is missing and how to compute them.
>
> **Audit date:** 2026-08-16 · **Auditor:** automated code audit · **Scope:** full repo.
>
> ⚠️ **The shipped model is NOT clinically validated.** Nothing in this report should
> be read as a claim of clinical safety or validity. See §R.

---

## Evidence: test suite run (this audit)

All suites were executed read-only; **no code was modified to make tests pass.**

| Suite | Command | Result |
|---|---|---|
| Web + shared TS (vitest) | `npm run test` | **26 passed** (8 files) + parity **4 passed** |
| Shared contract parity (Python) | `pytest packages/triage-shared/python/tests` | **5 passed** |
| API (FastAPI, pytest) | `pytest services/api/tests` | **68 passed** (1 warning) |
| ML pipeline (pytest) | `pytest ml/tests` | **9 passed** (3 warnings) |
| **Total** | | **112 passing, 0 failing** |

Warnings are third-party `DeprecationWarning`s (scipy L-BFGS-B `disp`/`iprint`), not
test failures.

**Critical caveat (expanded in §O):** the green suite does **not** exercise the
shipped model. `ml/tests/test_eval_gate.py` and `test_golden_vector.py` *train a
fresh synthetic model in-process* and assert on that. No test loads
`model_v2.1.0-real-appcompat.joblib` or asserts its emergency-recall gate.

---

## A. Current architecture

Monorepo (npm workspaces + editable Python packages), four runtime tiers.

```
apps/web              Next.js 14 App Router + React Three Fiber (TS)  → :3000
services/api          FastAPI + SQLAlchemy 2.0 + Pydantic v2 (Py 3.12) → :8000
ml/                   offline scikit-learn / XGBoost pipeline + artifacts
packages/triage-shared  contracts: UrgencyLevel, reasons, red-flag table
                        (TS + Python + JSON, parity-tested)
PostgreSQL :5432      durable sessions / assessments / audit logs
Redis :6379           WS pub/sub + (optional) cache
```

**Request path.** Browser builds a semantic patch (`apps/web/lib/triageState.ts:toPatch`)
→ sent over WebSocket (`ws/routes.py`, `ws/manager.py`) to a session → persisted
(`session_service.py`) → `triage.engine.assess()` produces a `TriageResult` →
persisted as an `Assessment` → pushed back live. REST equivalents exist under
`/api/v1/triage` and `/api/v1/sessions`.

**Process/model load.** `main.py:lifespan` loads a single process-wide
`PredictionService.from_dir(settings.ml_artifact_dir)` at startup; `from_dir`
selects the **lexicographically last** `model_*.joblib`, i.e.
`model_v2.1.0-real-appcompat.joblib`. A background `_purge_loop` runs the retention
purge every `purge_interval_seconds` (default 3600s).

**Boundaries are clean:** the browser never computes urgency; all safety logic is
server-side; the ML artifact is isolated behind `PredictionService` and fails safe.

**Observed doc/impl mismatch:** `deploy/docs/MODEL_CARD.md` (§Versioning) states
"Model artifacts are tracked in the `model_registry` table." **No `model_registry`
table exists** (`services/api/app/models/db.py` defines only `sessions`,
`assessments`, `audit_logs`; grep for `model_registry` across `services/ ml/
packages/` returns nothing). The claim is aspirational, not implemented.

---

## B. Current ML pipeline

Two distinct pipelines exist; **only one model actually serves.**

### B.1 Synthetic pipeline (`ml/medscope_ml/*`, model_v1.0.0) — NOT served
- `generate.py` + `labeler.py`: rule-seeded synthetic dataset (60k rows, seed 42,
  `redflag_target_fraction` 0.35).
- `features.py`: the **single feature-expansion boundary** (`expand`, `build_frame`,
  `feature_columns`) shared by training and serving. 51 columns derived from
  `triage_shared.feature_contract()`.
- `train.py`: trains LogReg + XGBoost, isotonic-calibrated, EMERGENCY sample-weight
  5.0, tunes an EMERGENCY decision threshold, enforces `emergency_recall_min=0.98`.
- `safety_eval.py`: emergency-recall gate + under-triage reporting.
- Committed metrics (`ml/artifacts/metrics.json`): macro-F1 **0.744**, EMERGENCY
  recall **0.990**, gate **PASS**, 5 classes incl. SELF_CARE.

### B.2 Real app-compatible model (`ml/notebooks/kaggle_appcompat_train.py`, model_v2.1.0-real-appcompat) — **SERVED**
- Trained on the **real Yale EMMLC ED dataset** (artifact `dataset:
  "5v_cleandf.rdata"`), on GPU (`device_trained: "cuda"`).
- Maps ESI acuity → app urgency and builds **exactly** the app's 51-column schema.
- Calibrated XGBoost (700 trees, depth 8, isotonic `CalibratedClassifierCV` cv=3),
  EMERGENCY sample-weight 3.0, EMERGENCY threshold tuned for **max F1** (not recall).
- **Artifact facts (read directly from the joblib):**
  `model_version=v2.1.0-real-appcompat`, `classes=[DOCTOR_SOON, EMERGENCY, ROUTINE,
  URGENT_TODAY]` (4 classes), `feature_columns` length **51**,
  `confidence_threshold=0.8`, `emergency_threshold=0.5`,
  `metrics={macro_f1: 0.339, emergency_recall: 0.8816}`.

### B.3 Provenance / reproducibility problem (important)
The **committed training script does not reproduce the shipped artifact.**
`kaggle_appcompat_train.py` saves `confidence_threshold=0.6` and
`emergency_threshold=tau` (the F1-tuned value). The shipped joblib instead carries
`confidence_threshold=0.8` and `emergency_threshold=0.5`, and an amended `note`
("…gate raised to 0.80 to curb EMERGENCY over-triage"). The artifact was therefore
**hand-edited after training.** Consequences:
- No committed, runnable path regenerates the exact shipped model.
- The stored `emergency_recall=0.8816` was computed at the training-time tuned τ,
  **not** at the shipped `emergency_threshold=0.5` — so the stored recall may not
  describe the model as actually served.

---

## C. Current safety pipeline

`triage/engine.py:assess()` runs a deterministic pipeline:

1. **Completeness gate** (`fallback.has_assessable_input`): no symptoms/regions/vitals
   → `INSUFFICIENT_INFO`, path `FALLBACK_MISSING`, confidence 0.0.
2. **Red-flag vitals** (`rules.evaluate_vitals`) and **3. red-flag symptoms**
   (`rules.evaluate_symptoms`), both from `redflags.table.json`. Fires merge via
   `escalate` (max-rank wins).
4. **ML baseline** (`_baseline`): if predictor ready and confident, use ML (path `ML`);
   on low confidence → `conservative_fallback` (path `FALLBACK_LOW_CONF`); on
   predict error / no model → `conservative_fallback` (path `FALLBACK_MODEL_ERROR`).
5. **Age-extreme modifier** (`apply_age_modifier`) nudges *only* fallback results,
   capped at URGENT_TODAY — it can never fabricate EMERGENCY.
6. **Escalate-only merge:** `final = escalate(red_flag_level, baseline_level)`.

**Invariants that hold (verified by reading the code):**
- Red flags run before ML and can only escalate (`escalate` returns the higher rank).
- Missing vital never fires reassuringly (`evaluate_vitals` `continue`s on `None`).
- Missing age uses the **most sensitive** threshold per rule
  (`rules._threshold_for`), never a less-conservative default.
- `conservative_fallback` never returns EMERGENCY (ceiling URGENT_TODAY at
  severity ≥ 8) — so **EMERGENCY can only come from red-flag rules or a confident
  ML EMERGENCY**. This is the backbone of the safety story.

---

## D. Feature-schema compatibility

**Compatible and guarded.** The serving skew guard (`ml/medscope_ml/predict.py`)
asserts `artifact["feature_columns"] == features.feature_columns()`; a mismatch
raises → engine falls back to `FALLBACK_MODEL_ERROR` (fail safe). Confirmed:
- Shipped artifact `feature_columns` length = **51**; `features.feature_columns()`
  produces 51 in the same canonical order (numeric → missing-indicators → sex one-hot
  → band one-hot → regions → symptoms → risks), sourced from
  `packages/triage-shared/schema/features.schema.json`.
- `test_golden_vector.py::test_feature_expansion_is_deterministic` guards column
  order/stability. It **passed** this run.
- `PredictionService.input_to_record` maps `TriageInput` → the semantic record
  `features.expand` consumes; the frontend `toPatch` payload matches `TriageInput`
  field-for-field. No mapping drift found.

**Minor robustness note:** `SymptomEntry.code` is a free `str` (no enum validation
against the 11-symptom vocab). Unknown codes are harmless (no feature/rule matches)
but are silently accepted.

---

## E. Training vs production feature availability (train/serve skew — real risk)

The shipped model is schema-compatible but **distribution-incompatible** on several
features, because the Yale training data cannot populate inputs the live UI does:

| Feature(s) | Value in TRAINING (Yale, appcompat script) | Value in PRODUCTION (live UI) | Skew |
|---|---|---|---|
| `severity_max` | **hard-coded 0.0** (`feat["severity_max"]=0.0`) | 0–10 (slider, default 5 on add) | **Yes — OOD** |
| `duration_hours` | **hard-coded 0.0** | user-entered hours | **Yes — OOD** |
| `region_*` (10 cols) | **all 0** ("regions: not in Yale → stay 0") | set when user taps the body | **Yes — OOD** |
| `risk_*` (5 cols) | keyword-matched from Yale cols (sparse/approx) | explicit user toggles | Partial |
| `sym_*` (11 cols) | keyword-matched from `cc_*` chief-complaint cols | explicit user selections | Partial (semantic gap) |
| vitals, age, sex | present in Yale | present | Low |

**Implication:** the model has **never seen** a nonzero `severity_max`,
`duration_hours`, or any region bit during training, yet these are exactly the
signals the product markets ("point at the body, rate severity"). At inference those
columns carry values from a region of feature space with **zero training support**.
Tree models extrapolate unpredictably there. Practically, the model's useful signal
is limited to age/sex/vitals + coarse binary symptoms — a fraction of what the UI
collects. This is the strongest ML-validity finding in the audit and directly
explains the ~0.34 macro-F1 ceiling.

---

## F. ESI → MedScope urgency mapping analysis

Mapping (from `kaggle_appcompat_train.py`): `ESI 1+2 → EMERGENCY`, `3 →
URGENT_TODAY`, `4 → DOCTOR_SOON`, `5 → ROUTINE`. Rows without ESI 1–5 dropped;
SELF_CARE and INSUFFICIENT_INFO are **never produced by the ML model** (4 classes).

**Analysis:**
- **Label semantics mismatch (validity gap).** ESI encodes *ED resource/acuity* for
  patients **who already presented to an ED**. MedScope's urgency encodes *how soon a
  member of the general public should seek care*. These are related but not the same
  construct; a model trained on ESI answers "how many resources will this ED visit
  need," not "should this person go to the ED." Mapping one onto the other is a
  defensible convention, **not** a validated equivalence.
- **Spectrum / selection bias.** Training population = ED arrivals (already
  self-selected as acute). The product's population = anyone at home, including
  low-acuity cases the ED never sees. The model has little signal for the
  ROUTINE/SELF_CARE tail — consistent with the observed ROUTINE F1 ≈ 0.001.
- **ESI 1+2 merge** is reasonable (1 = resuscitation, 2 = emergent), but ESI 2 is
  broad; merging inflates the EMERGENCY prior and, with the 3.0 up-weight, biases
  toward over-triage (acknowledged in MODEL_CARD).
- **SELF_CARE unreachable from ML** — only rules/fallback emit it. Acceptable but
  means one of the six advertised levels has no learned support.

---

## G. Model performance analysis

**Shipped model (from artifact + MODEL_CARD, computed on the Yale test split on Kaggle):**
- Macro-F1 **0.339** (4 classes). Not comparable to the synthetic 0.744 (5 classes,
  circular labels).
- Per-class (MODEL_CARD §SHIPPED): EMERGENCY **P0.39 / R0.88 / F0.54**; URGENT_TODAY
  F≈0.40; DOCTOR_SOON F≈0.42; ROUTINE F≈0.001.
- Interpretation: only marginally better than a majority/prior baseline on
  non-emergency classes; the model is essentially an **emergency-vs-rest** detector
  with heavy over-triage, deliberately leaned safe.

**Cannot be recomputed from the repo.** The Yale dataset is **not** in the repo
(Kaggle-only), and no held-out test set or predictions are committed. The only
machine-readable shipped metrics are the two numbers baked into the joblib
(`macro_f1`, `emergency_recall`). **Missing / how to compute:** re-run
`kaggle_appcompat_train.py` on Kaggle with the dataset mounted, and **commit** the
full `metrics_appcompat.json` (it already computes per-class P/R/F1, confusion
matrix, Brier) into `ml/artifacts/` alongside the model.

---

## H. Emergency recall analysis

- **Shipped model EMERGENCY recall = 0.88** (artifact `emergency_recall: 0.8816`).
  ≈ **12% of true ESI 1+2 cases are under-triaged by the ML model alone.**
- The synthetic model met a **0.98** gate; the shipped model has **no recall gate**
  (its threshold was tuned for max F1, then hand-set to 0.5).
- **Why the product is not (yet) unsafe on this axis:** EMERGENCY is guaranteed by
  the **red-flag rule engine**, which runs first and escalate-only. The ML model's
  low recall is backstopped for the *rule-covered* emergencies (hypoxia,
  brady/tachycardia, hypotension, FAST stroke, sepsis screen, etc.).
- **Residual risk:** emergencies that are **not** covered by a red-flag rule and are
  **missed by the ML model** get under-triaged. Because
  `conservative_fallback` caps at URGENT_TODAY and the 0.80 confidence gate demotes
  most mid-confidence ML EMERGENCY calls to fallback, the realistic ML contribution
  to EMERGENCY is small — the rules carry essentially the entire EMERGENCY guarantee.
  **The gap between "rule-covered emergencies" and "all true emergencies" is
  unquantified** (see §R) and is the central safety unknown.

---

## I. Confusion-matrix analysis

- **Synthetic v1.0.0** — full 5×5 confusion matrix is committed
  (`ml/artifacts/metrics.json`): EMERGENCY row 4426/4471 correct (25 → SELF_CARE via
  logreg row; xgboost row 4426 correct, 15→DOCTOR_SOON, 30→URGENT_TODAY). Adjacent
  confusions dominate (DOCTOR_SOON↔ROUTINE↔URGENT_TODAY), consistent with ordinal
  labels.
- **Shipped v2.1.0-real-appcompat** — **no confusion matrix is committed.** Cannot be
  reconstructed from the repo (no test set, no predictions). **How to compute:** it is
  already produced by `kaggle_appcompat_train.py` (`precision_recall_fscore_support`
  over `classes`); persist the returned `report` (which should be extended to include
  the raw confusion matrix via `sklearn.metrics.confusion_matrix`) into
  `ml/artifacts/metrics_appcompat.json` and commit it.

---

## J. Per-class precision / recall / F1

- **Synthetic v1.0.0 (committed):** EMERGENCY P0.96/R0.99/F0.975; URGENT_TODAY
  P0.75/R0.72/F0.73; DOCTOR_SOON P0.69/R0.67/F0.68; ROUTINE P0.59/R0.56/F0.57;
  SELF_CARE P0.77/R0.76/F0.76.
- **Shipped v2.1.0 (MODEL_CARD narrative only):** EMERGENCY P0.39/R0.88/F0.54;
  URGENT_TODAY F0.40; DOCTOR_SOON F0.42; ROUTINE F0.001. Full precision/recall for the
  three non-emergency classes are **not committed** (only F1 is narrated). **Missing:**
  commit the structured `per_class` block already computed by the appcompat script.

---

## K. Calibration analysis

- Both pipelines wrap the base estimator in `CalibratedClassifierCV(method="isotonic")`
  (synthetic cv=default, appcompat cv=3), which is the right intent for trustworthy
  confidence — the confidence gate (§L) depends on calibration being meaningful.
- **Synthetic:** Brier (mean OvR) **0.0456** is committed.
- **Shipped:** **no calibration evidence is committed** — the joblib stores only
  `macro_f1` and `emergency_recall`; no Brier, no reliability curve. The appcompat
  script *computes* a `brier_mean` but does not persist it into the artifact, and the
  Kaggle `metrics_appcompat.json` was not committed. **Calibration of the served model
  is currently unverifiable from the repo.** **How to compute:** commit `brier_mean`
  (already computed) plus a binned reliability table per class; ideally recalibrate on
  a held-out fold and store a calibration curve.
- **Caveat:** isotonic calibration on the training distribution does **not** transfer
  to the OOD region created by nonzero `severity_max`/`duration_hours`/regions at
  serving (§E). Reported confidence in production may be miscalibrated for exactly the
  inputs the UI emphasizes.

---

## L. Confidence-threshold analysis

- `predict.py` computes `low_confidence = confidence < artifact.confidence_threshold`
  using the **artifact's** value (**0.8** for the shipped model). The engine routes any
  low-confidence prediction to `conservative_fallback`.
- **Config inconsistency (monitoring bug):** `settings.ml_confidence_threshold = 0.6`
  is **not used at inference** — it is only echoed by the admin `/models` endpoint. So
  the **admin dashboard reports 0.6 while the model actually gates at 0.8.** Operators
  reading the dashboard get the wrong number.
- **EMERGENCY interaction:** `predict.py` forces the class to EMERGENCY when
  `proba[EMERGENCY] ≥ emergency_threshold` (0.5), but then sets `confidence =
  proba[EMERGENCY]`. If that is between 0.5 and 0.8, the engine marks it
  low-confidence and **discards** the ML EMERGENCY, dropping to `conservative_fallback`
  (≤ URGENT_TODAY). Net effect: **an ML EMERGENCY only survives when
  proba[EMERGENCY] ≥ 0.8.** This is defensible (rules own EMERGENCY) but means the
  0.5 emergency threshold is largely inert in the served path.
- **Bypass rate unknown.** With macro-F1 0.34 and a 0.8 gate, the ML path is likely
  taken infrequently (most predictions fall to fallback), i.e. the product is largely
  **rules+fallback-driven**. The actual ML-vs-fallback ratio **cannot be computed from
  the repo** (needs a labeled input distribution or production logs). **How to compute:**
  aggregate `Assessment.decision_path` in production (the admin dashboard already
  distributes decision paths) — the `FALLBACK_LOW_CONF` share is the ML bypass rate.

---

## M. Red-flag safety-invariant verification

**Verified from code + table:**
- Escalate-only merge is structurally enforced (`escalate` returns max rank;
  fallback modifier capped at URGENT_TODAY; `conservative_fallback` never EMERGENCY).
- Missing vital → cannot fire reassuringly; missing age → most-sensitive threshold.
- Tested: `services/api/tests/test_engine_invariants.py`,
  `test_redflags_emergency.py`, `test_low_confidence.py` (all pass this run), plus the
  TS/Python parity tests keep the rule table identical across languages.

**Gaps found in the rule table vs. collectable inputs:**
- Several symptom rules key off codes **not in the 11-symptom vocabulary** the UI/
  feature contract expose, so they **can never fire from the current UI**:
  `stridor` (symptom.airway), `thunderclap_headache` / `worst_ever_headache`
  (symptom.neuro_headache), `uncontrolled_bleeding` / `hematemesis` / `hemoptysis`
  (symptom.hemorrhage), `reduced_intake` (symptom.pediatric_dehydration).
  These rules are **dormant** — real red flags that the product cannot currently
  trigger because the intake never collects the inputs. (The rule *engine* is correct;
  the **vocabulary is too small** to feed it.)
- Thresholds are self-declared `provenance: "education-default"` and are **not**
  validated clinical cut-offs (correctly disclaimed in the table, UI, and PDF).

---

## N. End-to-end triage decision flow

```
UI state ──toPatch──▶ WS/REST ──▶ Session persist ──▶ engine.assess()
                                                          │
   ┌──────────────────────────────────────────────────────┘
   ▼
1 completeness gate ─(empty)─▶ INSUFFICIENT_INFO / FALLBACK_MISSING
   │ (has input)
2 vitals red flags ┐
3 symptom red flags┘──▶ escalate() ─▶ red_flag_level
   │
4 ML baseline ─ready&conf≥0.8─▶ ML level (path ML)
   │        ─low conf─▶ conservative_fallback (FALLBACK_LOW_CONF)
   │        ─error/none─▶ conservative_fallback (FALLBACK_MODEL_ERROR)
5 age modifier (fallback paths only, ≤ URGENT_TODAY)
6 final = escalate(red_flag_level, baseline_level)
   ▼
TriageResult ─▶ persist Assessment (+ input_snapshot) ─▶ push to client
```

Decision path is always recorded; every assessment stores `model_version`,
`engine_version`, `reasons`, and an `input_snapshot`. The flow is coherent and
fail-safe. No path lets the browser or a model *downgrade* a red flag.

---

## O. Existing test coverage

**Strengths (all passing this run — 112 tests):**
- API: 68 tests incl. engine invariants, red-flag emergencies, low-confidence
  routing, prediction service, rate limit, compliance, admin, websocket, latency;
  CI enforces **≥90% coverage on `app.triage`**.
- Shared: TS + Python parity (the rule table and urgency logic can't drift).
- Web: 26 vitest + Playwright axe/keyboard E2E in CI.
- ML: dataset, generator parity, eval gate, golden vector.

**Gaps (material):**
- **The shipped model is untested.** `test_eval_gate.py` / `test_golden_vector.py`
  train a *synthetic* model in-process and assert on it. **No test loads
  `model_v2.1.0-real-appcompat.joblib`**, asserts its recall, its schema, its
  thresholds, or that it even predicts. A broken/under-triaging shipped artifact
  passes CI.
- **No CI validation that the shipped artifact matches its training script** (the
  hand-edit in §B.3 would go undetected).
- **No committed metrics/regression fixture** for the shipped model, so there is no
  numeric baseline to detect drift on retrain.
- No property/fuzz test that random `TriageInput`s never produce a *downgrade* below
  the red-flag floor (the invariant is trusted to unit examples only).

---

## P. Security / privacy / data-rights status

**Implemented well for a prototype:**
- Data is anonymous, session-scoped. IPs are **hashed** (`audit/logger.hash_ip`,
  SHA-256 salted with `session_secret`, truncated). No raw IP stored.
- Audit log is append-only, no-PHI-in-meta; delete records an audit row **before**
  cascade delete.
- Data rights (`compliance.py`): full JSON **export**, hard **delete**
  (ORM cascade), retention **purge** (`expires_at`, default 30 days) run on a
  background loop and via `POST /admin/purge`.
- Admin RBAC (`security.require_admin`): shared `X-Admin-Token`, constant-time
  `hmac.compare_digest`, **fail-closed** when unset (empty token ⇒ 403 for all).
- Rate limiting present (`ratelimit.py`, default 120/min/IP+route).

**Risks / gaps:**
- `Assessment.input_snapshot` and `Session.*` persist user-entered health inputs in
  the clear (JSON). Acceptable *only* because the app forbids real PHI; there is **no
  encryption at rest** beyond whatever Postgres provides, and no field-level
  protection. Not HIPAA-ready (correctly disclaimed).
- `session_secret` and DB password have **dev defaults** in `config.py`/`.env`; must
  be overridden in any non-local deploy (IP-hash salt secrecy depends on it).
- Admin auth is a **single shared token**, no user identities, no audit of *who*
  (the `actor_user_id` column exists but is unused for admin reads).
- Rate limiter is **in-process** (per-worker), so it does not hold across multiple
  API replicas.
- CORS `allow_credentials=True` with an explicit origin list — fine, but review
  before adding wildcard origins.

---

## Q. Production gaps (engineering)

1. Shipped model not reproducible from committed code (§B.3); no artifact-provenance
   check in CI.
2. Admin `confidence_threshold` display (0.6) diverges from served value (0.8) (§L).
3. No committed metrics/regression baseline for the served model (§G/§I/§J/§K).
4. `model_registry` table promised in docs, not implemented (§A).
5. Rate limiting and (implicitly) session affinity are per-process; no distributed
   store for multi-replica deploys.
6. No structured request/inference logging or metrics export (Prometheus/OTel) —
   the admin dashboard is the only observability, and it has no ground-truth signal.
7. Secrets management relies on `.env` with dev defaults; no secret rotation story.

---

## R. Clinical validation gaps

1. **No clinical validation of any kind.** The model is trained on ESI (a resource
   proxy), mapped by convention to care-urgency, on an **ED-only** population. It has
   never been evaluated against clinician-adjudicated *care-urgency* labels on a
   *general-population* sample.
2. **Red-flag thresholds are education defaults**, explicitly not PEWS/NEWS2/APLS
   (correctly disclaimed) — no sensitivity/specificity established against a reference
   standard.
3. **Emergency coverage is unquantified:** the fraction of true emergencies that are
   *not* covered by a red-flag rule (and thus depend on the 0.88-recall model) is
   unknown. This is the key clinical-safety unknown (§H).
4. **Spectrum bias** (§F): performance on the low-acuity tail the product actually
   serves is essentially untested (ROUTINE F1 ≈ 0).
5. No prospective evaluation, no human-in-the-loop study, no external/temporal
   validation set.

**None of these can be closed with code changes alone** — they require a labeled,
representative, clinically-adjudicated dataset and a study design.

---

## S. Model monitoring gaps

- **No ground-truth capture.** Sessions store inputs + predictions but no outcome/
  disposition, so live precision/recall/calibration **cannot** be computed. The admin
  dashboard shows decision-path/urgency **distributions** and average confidence only.
- **No drift detection** on input features (e.g., rising nonzero `severity_max`/region
  usage that the model never trained on) or on prediction distribution.
- **No calibration monitoring** in production.
- **No alerting** on fallback-rate spikes, model-not-ready, or emergency-share shifts.
- **How to start (from what exists):** the `Assessment` table already logs
  `decision_path`, `urgency`, `confidence`, `model_version`, `input_snapshot` — enough
  to compute fallback rate, ML-bypass rate (`FALLBACK_LOW_CONF` share), and input-drift
  on the OOD features without new schema.

---

## T. Clinician workflow gaps

- Clinician **PDF report** exists (`report/pdf.py`) and an **admin safety dashboard**
  (aggregates only). There is **no clinician-facing review/override UI**, no case
  queue, no ability for a clinician to correct/label an assessment (which would also
  seed the missing ground-truth loop in §S).
- No role model beyond a single admin token (no clinician vs. admin vs. researcher).
- No escalation/handoff workflow (e.g., "call 911" affordance is advisory text only).
- The dormant red-flag inputs (§M) mean clinically-important presentations
  (thunderclap headache, hematemesis, stridor) cannot be entered at all.

---

## U. Recommended next phases

Ordered, minimal-surface, no architecture rewrite, no dependency bloat:

- **Phase 8 — Served-model integrity & metrics (highest priority, pure engineering).**
  Commit the shipped model's full metrics JSON (per-class P/R/F1, confusion matrix,
  Brier) next to the artifact; add a CI test that **loads the served joblib** and
  asserts schema (51 cols), classes, thresholds, and a **recall floor** on a committed
  fixture; reconcile `settings.ml_confidence_threshold` with the artifact value or
  remove the misleading display; make the artifact reproducible from a committed script
  (or record the exact post-processing as code).
- **Phase 9 — Safety-coverage quantification.** Measure and document the emergency
  set **not** covered by red-flag rules; expand the symptom vocabulary to feed the
  **dormant** rules (stridor, thunderclap/worst-ever headache, hematemesis/hemoptysis/
  uncontrolled bleeding, reduced intake). No threshold changes — vocabulary only.
- **Phase 10 — Monitoring & ground-truth loop.** Add outcome/label capture + a
  clinician review/override UI; compute fallback-rate, ML-bypass rate, input-drift on
  the OOD features from existing `Assessment` data; alert on emergency-share and
  model-not-ready.
- **Phase 11 — Honest model iteration.** Address train/serve skew (§E): either train
  a model that uses only production-available features (drop the always-zero
  severity/duration/region columns) *or* collect real severity/duration/region-labelled
  data; recalibrate; keep the rules-first architecture unchanged.
- **Phase 12 — Clinical validation track (non-code).** Assemble a clinically-adjudicated,
  general-population, care-urgency-labelled dataset; prospective + external/temporal
  evaluation before any claim beyond "research/education prototype."

---

# Executive summaries

## 1. TOP 10 highest-priority problems
1. **Shipped model has 0.88 emergency recall and no recall gate** — EMERGENCY safety
   rests almost entirely on the red-flag rules (§H).
2. **Train/serve skew:** `severity_max`, `duration_hours`, and all region features are
   always 0 in training but nonzero in production — the UI's headline signals are OOD
   for the model (§E).
3. **Shipped artifact is not reproducible from committed code** (thresholds/notes
   hand-edited post-training) (§B.3).
4. **Shipped model is untested** — CI validates a freshly-trained synthetic model, not
   the served joblib (§O).
5. **No committed metrics/confusion matrix/calibration for the served model** — the
   Yale data is Kaggle-only, so they can't be recomputed from the repo (§G/§I/§K).
6. **Emergency-coverage gap is unquantified** — fraction of true emergencies not caught
   by red-flag rules is unknown (§H/§R).
7. **Dormant red-flag rules** referencing symptoms the UI can't collect
   (stridor, thunderclap headache, hematemesis, …) (§M).
8. **Confidence-threshold reporting bug** — admin shows 0.6, inference uses 0.8 (§L).
9. **ESI→urgency is a construct mismatch on an ED-only population** (spectrum/selection
   bias); ROUTINE F1 ≈ 0 (§F).
10. **No production monitoring / ground-truth loop** — live precision/recall/calibration
    cannot be measured (§S).

## 2. TOP 5 safety risks
1. Non-rule-covered emergencies under-triaged by the 0.88-recall model (§H).
2. Dormant red-flag rules ⇒ real red-flag presentations can't be entered (§M).
3. Miscalibrated confidence in the OOD serving region ⇒ the 0.80 gate may admit/deny
   the wrong cases (§K/§E).
4. Education-default thresholds unvalidated against any reference standard (§R).
5. Any future removal/weakening of the rule engine would remove the *only* real
   EMERGENCY guarantee — the architecture's safety hinges on it (§C/§H).

## 3. TOP 5 ML risks
1. Train/serve feature skew makes headline inputs meaningless to the model (§E).
2. Served model unversioned in metrics terms + not reproducible ⇒ silent regressions
   on retrain (§B.3/§G).
3. Uncalibrated-in-production confidence drives the routing decision (§K/§L).
4. ESI label validity + spectrum bias cap achievable performance and mislead macro-F1
   comparisons (§F).
5. 4-class model can't emit SELF_CARE/INSUFFICIENT_INFO; ROUTINE effectively unlearned
   (§F/§G).

## 4. TOP 5 production-engineering risks
1. No CI gate on the served artifact (schema/recall/threshold) (§O).
2. Config vs artifact threshold divergence surfaced to operators (§L).
3. In-process rate limiting (and no documented session affinity) won't hold across
   replicas (§P).
4. Dev-default secrets (`session_secret`, DB password) leak IP-hash/DB safety if
   shipped unchanged (§P).
5. No structured metrics/telemetry export; observability is a single aggregate
   dashboard with no ground truth (§S/§Q).

## 5. Exact recommended next implementation phase

**Phase 8 — "Served-Model Integrity & Metrics" (engineering-only, no model/threshold/
architecture change).** Concretely:
1. Commit `ml/artifacts/metrics_appcompat.json` with the served model's per-class
   P/R/F1, **confusion matrix**, and **Brier** (all already computed by
   `kaggle_appcompat_train.py`; add `sklearn.metrics.confusion_matrix`).
2. Add `services/api/tests/test_served_model.py` that **loads
   `model_v2.1.0-real-appcompat.joblib`** and asserts: 51-column schema equals
   `features.feature_columns()`, classes set, `confidence_threshold`/`emergency_threshold`
   present, `predict()` runs on a golden record, and stored `emergency_recall` ≥ a
   committed floor. Wire it into CI.
3. Fix the confidence-threshold display: have the admin endpoint read the **artifact's**
   value (or delete `settings.ml_confidence_threshold` and the misleading field).
4. Make the served artifact reproducible: fold the post-training threshold/note edits
   into `kaggle_appcompat_train.py` (or a committed post-process script) so the joblib
   can be regenerated deterministically.

Rationale: this is the highest-leverage, lowest-risk work — it makes the *current*
safety story auditable and regression-proof **without** touching the model, the
thresholds, or the architecture, and it unblocks every later phase (monitoring,
coverage quantification, honest retraining) by giving them a committed numeric baseline.

---

### Explicitly NOT done in this audit (per instructions)
No model retrained, no metrics recomputed or "improved," no red-flag thresholds
changed, no architecture replaced, no dependencies added, and no source files modified
to make tests pass. This document is the only file created.
