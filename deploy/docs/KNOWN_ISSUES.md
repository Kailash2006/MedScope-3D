# Known Issues / Tracked Debt

Living list of accepted-for-now gaps. Reviewed each phase.

## Verification gaps

- **Docker Compose full bring-up unproven.** Phase 0 AC says
  `docker compose up` starts web/api/db/redis healthy. Build *inputs* are
  verified (Next standalone build succeeds, API package installs, Dockerfiles +
  healthcheck-gated compose written), but the four-container healthy bring-up has
  **not** been executed end-to-end (local Docker daemon was not running during
  Phase 0). **Action:** run `docker compose -f deploy/docker-compose.yml up --build`
  and confirm all four services report healthy before closing Phase 0 fully.

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
