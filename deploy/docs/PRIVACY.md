# MedScope 3D — Privacy Notes

> Research/education prototype. **Not HIPAA-compliant.** Do not enter real,
> identifiable health information.

## Data minimization

- Anonymous sessions by default — no login required to triage.
- Optional email + magic-link accounts only (no passwords stored) to persist
  history across devices. OAuth deferred.
- No unnecessary personal data collected. IP addresses in audit logs are hashed.

## Retention

- Per-user retention window (default 30 days, configurable in Settings) drives an
  automatic purge job on `sessions` and cascaded children.
- Audit logs use a separate, longer window (default 365 days) for compliance.

## User data rights (implemented)

Data is anonymous and **session-scoped**, so "your data" == the session the client
holds (per-account aggregation lands with full auth in a later phase).

- **Export:** `GET /api/v1/sessions/{id}/export` returns a full JSON bundle
  (session + assessments + this session's audit rows + disclaimer + privacy note).
- **Delete:** `DELETE /api/v1/sessions/{id}` hard-deletes the session and all
  cascaded assessments (writes a no-PHI audit row first), returning a 404 after.
- **Retention:** `PATCH /api/v1/sessions/{id}/retention` moves `expires_at`;
  `GET /api/v1/settings/retention` reports the defaults.
- **Automatic purge:** a background scheduler (`PURGE_INTERVAL_SECONDS`) removes
  sessions past `expires_at`; `POST /api/v1/admin/purge` triggers it manually.
- The frontend surfaces all of this in a "Your data & privacy" panel
  (export / delete with two-step confirm / retention).

## Audit logging

- Append-only `audit_logs`; no PHI stored in log metadata.
- Records actor, action, target, hashed IP, timestamp.

## Disclaimers

Every assessment and report carries a disclaimer that this is not a diagnosis,
not medical advice, and that thresholds are education defaults (see MODEL_CARD.md).
