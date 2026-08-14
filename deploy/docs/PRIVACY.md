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

## User data rights (Phase 6)

- **Export:** `GET /me/export` returns all user data (JSON/ZIP).
- **Delete:** `DELETE /me/data` soft-deletes then purges all cascaded rows.

## Audit logging

- Append-only `audit_logs`; no PHI stored in log metadata.
- Records actor, action, target, hashed IP, timestamp.

## Disclaimers

Every assessment and report carries a disclaimer that this is not a diagnosis,
not medical advice, and that thresholds are education defaults (see MODEL_CARD.md).
