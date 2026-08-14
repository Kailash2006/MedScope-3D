# MedScope 3D — Deployment

## Local (Docker Compose)

```bash
cp .env.example .env          # then edit secrets
docker compose -f deploy/docker-compose.yml up --build
```

Services:

| Service | URL | Notes |
|---|---|---|
| web | http://localhost:3000 | Next.js (standalone) |
| api | http://localhost:8000 | FastAPI; `/healthz`, `/readyz`, `/api/v1/meta` |
| db  | localhost:5432 | Postgres 16 |
| redis | localhost:6379 | Redis 7 |

Healthchecks gate startup order (`web` waits for `api` healthy, `api` waits for
`db` + `redis` healthy).

## Local (without Docker)

```bash
# Frontend + shared contracts
npm install
npm run dev:web

# Backend
pip install ./packages/triage-shared/python
pip install -e "./services/api[dev]"
cd services/api && uvicorn app.main:app --reload
```

## Environment

All config via `.env` (see `.env.example`). In Compose, `DATABASE_URL` and
`REDIS_URL` are overridden to use service names.

## Configuration notes

- `SESSION_SECRET` must be a real ≥32-char secret in any shared environment.
- `ML_CONFIDENCE_THRESHOLD` controls the low-confidence fallback boundary.
- `DEFAULT_RETENTION_DAYS` / `AUDIT_RETENTION_DAYS` control purge windows.

## Phased rollout

Database migrations (Alembic), WebSocket gateway, and the model artifact volume
are wired in Phases 3+. Phase 0 ships a buildable skeleton with health endpoints
and the shared contract only.
