# MedScope 3D — Go Live (Vercel + Render + Neon)

Exact, copy-paste steps. **Everything in the repo is prepared and verified**
(see "Pre-verified" below). The steps below are the parts that need *your*
accounts — I can't create accounts or authorize OAuth for you.

## Pre-verified (done, in the repo)
- ✅ Web production build passes (`apps/web` builds clean → Vercel will build).
- ✅ API Docker image builds; entrypoint boots rules-only on SQLite and binds `$PORT`.
- ✅ Frontend URL bake fixed (real API URL is inlined at build, not `localhost`).
- ✅ `render.yaml` Blueprint, `deploy/api-entrypoint.sh`, `.gitattributes` (LF) in place.
- ✅ 112 tests passing across web/api/ml/shared this session.
- ✅ 8 deploy commits ready on `main`.

## What you do (≈15 min)

### 0. Put the repo on GitHub
```bash
gh auth login                       # or create a repo in the GitHub UI
gh repo create medscope-3d --private --source=. --remote=origin --push
# (no gh? create an empty repo in the UI, then:)
#   git remote add origin https://github.com/<you>/medscope-3d.git
#   git push -u origin main
```

### 1. Database — Neon  (neon.tech → free)
Create a project, copy the connection string, and rewrite it to psycopg form:
```
postgresql+psycopg://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/DBNAME?sslmode=require
```
Keep `?sslmode=require`. Save it — it's `DATABASE_URL` for Render.

### 2. API — Render  (render.com → New → Blueprint → pick your repo)
Render reads `render.yaml`. In the service's **Environment**, set the secrets:

| Var | Value |
|---|---|
| `DATABASE_URL` | the Neon URL from step 1 |
| `SESSION_SECRET` | any random ≥32 chars (e.g. `openssl rand -hex 24`) |
| `ADMIN_TOKEN` | any strong string (empty ⇒ `/admin` disabled) |
| `CORS_ORIGINS` | *(fill after step 4; put a placeholder for now)* |
| `MODEL_URL` | *(optional — leave blank to run rules-only; see step 3)* |

Deploy. Copy the service URL: `https://<name>.onrender.com`.
Check: `curl https://<name>.onrender.com/healthz` → `{"status":"ok",...}`.

### 3. (Optional) ship the ML model
Default = **rules-only** (safe, works now). To add the model:
```bash
gh auth login
sh scripts/publish-model-release.sh
```
It prints a `MODEL_URL=...` line — paste that value into Render → `MODEL_URL`,
redeploy, then `curl .../readyz` should show `"ready":true`.

### 4. Web — Vercel  (vercel.com → Add New → Project → import your repo)
- **Root Directory:** `apps/web`  (Next.js auto-detected)
- **Environment Variables (Production):**
  - `NEXT_PUBLIC_API_BASE_URL` = `https://<name>.onrender.com`
  - `NEXT_PUBLIC_WS_BASE_URL` = `wss://<name>.onrender.com`
- Deploy. Copy your URL: `https://<project>.vercel.app`.

### 5. Close the loop
On **Render**, set `CORS_ORIGINS = https://<project>.vercel.app` and redeploy.
Open the Vercel URL → **/triage** → add a symptom; the risk panel should update live.

## Notes
- Both Render and Vercel **auto-deploy on every `git push`** once connected — no CI wiring needed.
- Free-tier: Render sleeps when idle (slow first hit); Neon suspends compute (first query wakes it).
- Change `NEXT_PUBLIC_*`? Redeploy Vercel (they're baked at build time).
