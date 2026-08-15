# Known Issues / Tracked Debt

Living list of accepted-for-now gaps. Reviewed each phase.

## Verification gaps

- ~~**Docker Compose full bring-up unproven.**~~ **RESOLVED 2026-08-14.**
  `docker compose -f deploy/docker-compose.yml up --build` brings up all four
  services **healthy** (db, redis, api, web). Verified end-to-end:
  `GET /healthz` → ok, `GET /api/v1/meta` → shared urgency levels + disclaimer,
  `GET http://localhost:3000/` → HTTP 200 with correct title.
  Fix required for the web image: Next.js standalone output in an npm-workspaces
  monorepo excludes the hoisted root `node_modules` unless traced from the repo
  root — set `outputFileTracingRoot` to the repo root and give the Docker build a
  root lockfile, then copy the monorepo-nested standalone
  (`apps/web/server.js` + `node_modules`) and launch `node apps/web/server.js`.
  A `web` healthcheck was also added so compose reports it healthy, not just running.

## Frontend (Phase 4)

- **A11y: axe-core measured (clean); Lighthouse number still not run.** Ran
  axe-core (WCAG 2.0/2.1 A + AA) against the live `/triage` page: **12 passes,
  0 incomplete, 1 violation**. The single violation (`meta-viewport`, zoom
  disabled) did **not** originate from our source (grep clean) — it was injected
  by the automation/extension environment. A defensive accessible `viewport`
  export was added to `app/layout.tsx` regardless. So axe is effectively clean on
  our markup. A full **Lighthouse** score (which also weighs performance/SEO
  heuristics) was still not run — defer to the Phase 7 Playwright+axe CI job.
- **Full keyboard-only run not scripted.** Structure supports it and was spot-
  checked, but there is no automated keyboard-only E2E yet (deferred with the
  Playwright option).

## API / real-time (Phase 3)

- **DB schema via `create_all`, not Alembic yet.** Tables are created from the
  SQLAlchemy models at startup (`init_db`). Fine for the prototype, but there are
  no versioned migrations. **Action:** add Alembic in Phase 7 (hardening) before
  any schema evolves in a shared/persistent environment.
- **Redis WS pub/sub proven single-instance only.** The manager publishes to a
  per-session Redis channel and a subscriber rebroadcasts, so multiple API
  instances *should* stay in sync — but this was only exercised with one API
  instance (in-process + Redis round-trip verified live). Multi-instance fan-out
  is unproven. Same class of gap as the earlier unproven paths.
- **No auth/RBAC yet.** Anonymous sessions only; the recommended magic-link +
  RBAC model (admin dashboard, GDPR endpoints) lands in Phases 5/6.

## ML pipeline (Phase 2)

- **Multi-GPU Kaggle notebook unproven.** `ml/notebooks/medscope_kaggle_train.ipynb`
  (Dask-CUDA + xgboost.dask across both GPUs) was authored but **not executed** —
  no GPU in this environment. Same class of gap as the earlier Docker bring-up:
  proven-by-construction, not proven-by-run. **Action:** run it end-to-end on
  Kaggle (GPU T4 ×2) and confirm the emergency-recall gate passes before any
  larger/GPU-trained artifact is relied upon. The shipped local artifact
  (v1.0.0, 60k rows, CPU) is the only run actually verified.
- **Macro-F1 ≈ 0.744 is modest.** Expected: synthetic rule-seeded data plus a
  deliberate emphasis on EMERGENCY recall (up-weighting + asymmetric threshold)
  trades non-emergency precision for recall. Watch this if/when real data or a
  larger synthetic set is used; revisit class balance and the emergency threshold
  τ. Not a correctness issue — EMERGENCY class itself is P0.96/R0.99.

## Dependency audit (npm) — snapshot 2026-08-14

`npm audit`: **10 vulnerabilities (1 critical, 6 high, 3 moderate, 0 low)**.
All are in the **dev / build toolchain**, not the API runtime:

| Package | Chain | Notes |
|---|---|---|
| next | direct (web) | advisory-driven; fix requires major bump |
| esbuild, vite, vite-node, vitest, @vitest/mocker | dev/test | test runner chain |
| postcss | build | source-map advisory |
| eslint-config-next, @next/eslint-plugin-next | lint | dev only |
| glob | transitive | dev only |

**Decision:** not applying `npm audit fix --force` — it forces a breaking
Next.js major upgrade. Revisit when we intentionally bump Next (likely Phase 4
when the real frontend lands). None of these ship in the API/runtime image.

## API surface

- Phase 0 exposes only `/healthz`, `/readyz`, `/api/v1/meta` — expected; the
  triage engine, sessions, WS, report, admin, and GDPR routes arrive in
  Phases 1/3/5/6 per the API contract.
