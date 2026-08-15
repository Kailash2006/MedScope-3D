# MedScope 3D — Deployment

> Research/education prototype. **Not HIPAA-compliant.** Do not enter real,
> identifiable health information.

## Reproducible from a clean machine

Prerequisites: Docker + Docker Compose (that's all — Node/Python are only needed
for local non-Docker dev).

```bash
git clone <repo> && cd medscope-3d
cp .env.example .env            # then edit secrets (see below)
docker compose -f deploy/docker-compose.yml up --build
```

Then:

| Service | URL | Notes |
|---|---|---|
| web | http://localhost:3000 | Next.js; `/triage`, `/admin` |
| api | http://localhost:8000 | FastAPI; `/healthz`, `/readyz`, `/docs` |
| db  | localhost:5432 | Postgres 16 |
| redis | localhost:6379 | Redis 7 |

Healthchecks gate startup order (web waits for api healthy; api waits for
db + redis healthy). All four report `healthy` when ready.

**Verify the stack:**
```bash
curl localhost:8000/healthz                       # {"status":"ok",...}
curl localhost:8000/readyz                        # includes model readiness
curl -X POST localhost:8000/api/v1/sessions -H 'content-type: application/json' -d '{}'
```

## Configuration (`.env`)

| Var | Purpose |
|---|---|
| `POSTGRES_*`, `DATABASE_URL` | Postgres connection |
| `REDIS_URL` | WS pub/sub + (future) shared rate limits |
| `SESSION_SECRET` | cookie signing / IP-hash salt — set a real ≥32-char value |
| `ADMIN_TOKEN` | admin dashboard RBAC; **empty disables /admin (403)** |
| `ML_ARTIFACT_DIR` | model artifact dir (mounted read-only); empty ⇒ rules-only |
| `ML_CONFIDENCE_THRESHOLD` | ML low-confidence fallback boundary |
| `RATE_LIMIT_PER_MINUTE` | per-IP+route limit; 0 disables |
| `PURGE_INTERVAL_SECONDS` | retention purge cadence; 0 disables the scheduler |
| `DEFAULT_RETENTION_DAYS` / `AUDIT_RETENTION_DAYS` | retention windows |

## Database migrations (Alembic)

The API auto-creates tables at startup for dev/test convenience. **In a shared or
production environment, manage schema with Alembic** instead:

```bash
cd services/api
DATABASE_URL=<prod-url> alembic upgrade head
```

The initial revision (`alembic/versions/0001_initial.py`) matches the ORM models.
Create new revisions as the schema evolves (`alembic revision -m "..."`).

## Model artifact

The API serves the newest `model_*.joblib` in `ML_ARTIFACT_DIR` (mounted from
`ml/artifacts`). If none is present, `PredictionService` stays not-ready and the
engine runs **rules-only** (safe conservative fallback). To produce an artifact:

```bash
pip install -e ./packages/triage-shared/python -e ./ml
python -m medscope_ml.train        # writes ml/artifacts/model_v1.0.0.joblib
```

(Or run `ml/notebooks/medscope_kaggle_train.ipynb` on a 2-GPU Kaggle host.)

## Local dev without Docker

```bash
npm install && npm run dev:web
pip install -e ./packages/triage-shared/python -e "./services/api[dev]" -e "./ml[dev]"
cd services/api && uvicorn app.main:app --reload
```

## Hardening notes

- **Rate limiting** is in-process per API instance; for multi-instance deploys,
  move to a Redis-backed limiter (interface in `app/ratelimit.py`).
- **Admin RBAC** is a shared-token stand-in; replace with real user roles when
  auth lands.
- **CORS**: set `CORS_ORIGINS` to your real web origin(s) in production.
- Run behind TLS; never expose Postgres/Redis publicly.
