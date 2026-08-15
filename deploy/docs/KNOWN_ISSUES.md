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

## Frontend a11y (RESOLVED in Phase 7)

- ~~axe not measured in CI~~ **RESOLVED.** A Playwright + `@axe-core/playwright`
  E2E (`apps/web/e2e/a11y.spec.ts`, CI job `e2e`) runs WCAG 2.1 A/AA against a
  clean chromium and asserts **no serious/critical violations** — currently green.
  It caught a real bug: muted text `#64748b` on the dark bg was 3.95:1 (< 4.5:1);
  fixed by bumping to `#94a3b8` across the UI.
- ~~keyboard-only run not scripted~~ **RESOLVED.** The same spec drives
  keyboard-only region selection (focus → Enter/Space toggles `aria-pressed`) and
  a tab-flow check — green.
- **Lingering:** a full **Lighthouse** score (which also weighs perf/SEO/best-
  practices, beyond a11y) is still not run. axe covers the a11y ruleset and
  passes; a Lighthouse number is a nice-to-have, not a correctness gap.

## API / real-time (Phase 3)

- ~~**DB schema via `create_all`, not Alembic yet.**~~ **RESOLVED in Phase 7.**
  Alembic is set up (`services/api/alembic/`, initial revision `0001_initial`
  matching the models); validated by upgrade→downgrade in CI and confirmed inside
  the api container. `init_db`'s `create_all` remains the dev/test convenience;
  production uses `alembic upgrade head` (see DEPLOYMENT.md).
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

## Dependency audit (npm) — revisited 2026-08-15 (Phase 7)

`npm audit`: **10 vulnerabilities (1 critical, 6 high, 3 moderate, 0 low)**.
`npm audit fix` (non-breaking) resolves **none** — every fix is a semver-major.
Precise triage:

| Severity | Package | Ships at runtime? | Fix |
|---|---|---|---|
| **critical** | `vitest` (+ @vitest/mocker) | **No** — dev test runner only | vitest 3 (major) |
| high | `next` | **Yes** — Next standalone server | Next 16 (major, 14→16) |
| high/mod | esbuild, vite, vite-node, postcss | No — dev/build chain | via vitest/vite majors |
| mod | eslint-config-next, @next/eslint-plugin-next, glob | No — lint/dev | major |

**The critical is dev-only** (vitest); it never ships. The only runtime-affecting
item is **`next` (high)**, fixable only by a Next **14→16 major upgrade** — a
dedicated migration with its own testing, out of scope for a hardening pass.
Practical exposure on this prototype is low (no custom middleware; not public).

**Decision:** defer both as tracked work. Do NOT `npm audit fix --force`
(breaks the build). Schedule a deliberate Next 14→16 + vitest 2→3 upgrade as its
own task.

## API surface

- Phase 0 exposes only `/healthz`, `/readyz`, `/api/v1/meta` — expected; the
  triage engine, sessions, WS, report, admin, and GDPR routes arrive in
  Phases 1/3/5/6 per the API contract.
