# MedScope 3D

Real-time 3D machine-learning **symptom triage** prototype. Users select body
regions on a 3D human model, enter symptoms / severity / duration / risk factors
/ vitals, and receive **urgency guidance only** — never a diagnosis, never a
medication recommendation.

> ⚠️ **Research / education prototype. NOT HIPAA-compliant. NOT medical advice.**
> Red-flag thresholds are simplified triage-education defaults, not validated
> clinical cut-offs. See `deploy/docs/MODEL_CARD.md`.

## Urgency levels

`EMERGENCY` · `URGENT_TODAY` · `DOCTOR_SOON` · `ROUTINE` · `SELF_CARE` · `INSUFFICIENT_INFO`

## Architecture (summary)

- **apps/web** — Next.js + TypeScript + React Three Fiber. Immersive 3D UI: glassmorphic design system, interactive 3D page background, a medical body-scan hero, an interactive 3D body mapper (with 2D SVG fallback), tabbed intake console, live risk panel, charts, clinician PDF, admin dashboard.
- **services/api** — FastAPI (triage engine: rules → ML → fallback; WS gateway; audit; retention)
- **ml/** — offline scikit-learn / XGBoost pipeline. **Ships a model trained on real ED data** (see below); synthetic pipeline kept for reference/parity.
- **packages/triage-shared** — single source of truth for `UrgencyLevel`, reason/decision schemas, and the age-banded red-flag rule table (TS + Python + JSON, parity-tested)
- **PostgreSQL** durable data + audit logs · **Redis** WS pub/sub + session cache

**Safety invariant:** red-flag rules run server-side before ML and can only
*escalate* urgency, never downgrade. The browser never decides urgency.

## The ML model

The app serves **`model_v2.1.0-real-appcompat`** — a calibrated XGBoost model
trained on the **real Yale EMMLC ED triage dataset** (~558k de-identified ED
visits; ESI acuity + triage vitals + chief complaints). It emits **exactly** the
app's 51-column feature schema (`medscope_ml.features.feature_columns()`), so it
is a drop-in for the API's `PredictionService`. ESI is mapped to urgency
(`1+2 → EMERGENCY`, `3 → URGENT_TODAY`, `4 → DOCTOR_SOON`, `5 → ROUTINE`).

- Macro-F1 ≈ **0.34** (4 classes) — capped by the app's sparse inputs (a handful
  of symptoms + vitals) vs the ~287 features a rich model uses. **Honest, not
  clinically validated.** Over-triage is curbed with a 0.80 confidence threshold;
  low-confidence and red-flag cases fall back to conservative rules.
- Training script: `ml/notebooks/kaggle_appcompat_train.py` (run on Kaggle GPU).
- The earlier synthetic model (`model_v1.0.0`) remains for reference. Full
  provenance and caveats: `deploy/docs/MODEL_CARD.md`.

## Quick start

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml up --build
# web  → http://localhost:3000
# api  → http://localhost:8000/healthz
```

## Repo layout

```
apps/web              Next.js frontend
services/api          FastAPI backend
ml/                   offline ML pipeline + artifacts
packages/triage-shared  shared contracts (UrgencyLevel, reasons, red-flag table)
deploy/               docker-compose, Dockerfiles, docs
```

## Development

```bash
npm install                 # installs web + shared (npm workspaces)
npm run test                # TS parity + web tests
npm run lint

cd services/api && pip install -e ".[dev]" && pytest
```

## Phased status

- [x] **Phase 0** — Scaffold & contracts
- [x] **Phase 1** — Safety engine (red-flag rules first, no ML)
- [x] **Phase 2** — ML pipeline (synthetic data → XGBoost, emergency-recall gate)
- [x] **Phase 3** — Triage API + real-time (PredictionService, sessions, WebSocket)
- [x] **Phase 4** — Frontend core (3D body mapper, live risk panel, 2D fallback, a11y)
- [x] **Phase 5** — History, charts, clinician PDF, admin safety dashboard (RBAC)
- [x] **Phase 6** — Compliance & data rights (export/delete, retention, purge, privacy)
- [x] **Phase 7** — Hardening & deployment (rate limit, error boundaries, Alembic, a11y/keyboard E2E, coverage gate)

### Beyond the phases

- [x] **Real-data model** — retrained on the Yale EMMLC ED dataset and shipped an
  app-compatible drop-in (`model_v2.1.0-real-appcompat`) serving live in the API.
- [x] **Immersive 3D UI overhaul** — glassmorphic design system; interactive 3D
  page background with pointer parallax + scroll drift; scroll-driven card
  reveals; medical **body-scan hero** (holographic wireframe human, sweeping scan
  ring, heartbeat pulse rings, DNA helix, orbital rings + starfield); tabbed
  **intake console** replacing stacked form cards; custom glass **dropdown**
  (portaled, keyboard-accessible); confidence gauge; re-centered, symmetric 2D
  body map. Fixed a duplicate-three.js regression (pinned `three` via `overrides`).
