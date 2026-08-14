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

- **apps/web** — Next.js + TypeScript + React Three Fiber (3D mapper, live risk, charts, PDF, admin)
- **services/api** — FastAPI (triage engine: rules → ML → fallback; WS gateway; audit; retention)
- **ml/** — offline scikit-learn / XGBoost pipeline (synthetic dataset → train → eval → artifacts)
- **packages/triage-shared** — single source of truth for `UrgencyLevel`, reason/decision schemas, and the age-banded red-flag rule table (TS + Python + JSON, parity-tested)
- **PostgreSQL** durable data + audit logs · **Redis** WS pub/sub + session cache

**Safety invariant:** red-flag rules run server-side before ML and can only
*escalate* urgency, never downgrade. The browser never decides urgency.

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
- [ ] Phase 3 — Triage API + real-time
- [ ] Phase 4 — Frontend core
- [ ] Phase 5 — History / charts / PDF / admin
- [ ] Phase 6 — Compliance & data rights
- [ ] Phase 7 — Hardening & deployment
