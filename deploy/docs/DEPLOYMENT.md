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

## Production (cloud / server host)

Use **`deploy/docker-compose.prod.yml`** — it hardens the dev stack: db/redis have
no published ports, web/api bind to `127.0.0.1` (front them with a TLS proxy),
Alembic runs before the API starts, and the web bundle is built with your **real**
public URLs.

### 1. Reverse proxy + TLS (you provide)
Run nginx / Caddy / Traefik on the host, terminate TLS, and route:

| Public origin | → forwards to | Notes |
|---|---|---|
| `https://app.example.com` | `127.0.0.1:3000` (web) | your users' entry point |
| `https://api.example.com` | `127.0.0.1:8000` (api) | must also upgrade **WebSocket** (`/ws/...`) → `wss://` |

The API origin must be publicly reachable by the browser (the frontend calls it
directly) and must proxy WebSocket upgrades.

### 2. `.env` (production values)
```
POSTGRES_PASSWORD=<strong-unique>
SESSION_SECRET=<random >=32 chars>            # IP-hash salt
ADMIN_TOKEN=<strong>                          # empty => /admin disabled (403)
CORS_ORIGINS=https://app.example.com          # your web origin(s)
PUBLIC_API_URL=https://api.example.com        # baked into web at build time
PUBLIC_WS_URL=wss://api.example.com           # baked into web at build time
ML_ARTIFACT_HOST_DIR=../ml/artifacts          # where the .joblib lives on this host
```
`PUBLIC_API_URL` / `PUBLIC_WS_URL` are **compiled into the web bundle at build
time** (Next.js `NEXT_PUBLIC_*`). If you change them, rebuild the web image
(`--build`). This is why the dev image cannot be reused unchanged in prod — a
dev build hard-codes `localhost:8000`.

### 3. Model artifact
`ml/artifacts/*.joblib` is **gitignored**, so a fresh clone has no model and the
API will run **rules-only** (safe, but no ML). Copy the trained
`model_*.joblib` onto the server at `ML_ARTIFACT_HOST_DIR` before starting, or
point that var at wherever you stage it.

### 4. Launch
```bash
docker compose -f deploy/docker-compose.prod.yml up -d --build
# verify
curl -s http://127.0.0.1:8000/healthz
curl -s http://127.0.0.1:8000/readyz     # confirm model.ready + model_version
```

### 5. Scaling caveats (single-host defaults)
- **One API replica.** The rate limiter (`app/ratelimit.py`) is in-process; the WS
  manager broadcasts in-process unless Redis is wired for pub/sub. For multiple API
  replicas, put both on Redis and add sticky sessions at the proxy.
- Back up the `db_data` volume; never expose Postgres/Redis publicly (this file
  already keeps them off the host network).

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
