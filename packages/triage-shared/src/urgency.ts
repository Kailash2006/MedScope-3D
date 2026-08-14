import urgencyJson from "../schema/urgency.json";

/** Canonical urgency levels. Order/rank come from schema/urgency.json (single source of truth). */
export const URGENCY_LEVELS = urgencyJson.levels.map((l) => l.value) as readonly string[];

export type UrgencyLevel =
  | "EMERGENCY"
  | "URGENT_TODAY"
  | "DOCTOR_SOON"
  | "ROUTINE"
  | "SELF_CARE"
  | "INSUFFICIENT_INFO";

export const INSUFFICIENT_INFO: UrgencyLevel = urgencyJson.sentinel as UrgencyLevel;

const RANK: Record<string, number> = Object.fromEntries(
  urgencyJson.levels.map((l) => [l.value, l.rank]),
);

export function rankOf(level: UrgencyLevel): number {
  return RANK[level] ?? 0;
}

export function labelOf(level: UrgencyLevel): string {
  return urgencyJson.levels.find((l) => l.value === level)?.label ?? level;
}

export function adviceOf(level: UrgencyLevel): string {
  return urgencyJson.levels.find((l) => l.value === level)?.advice ?? "";
}

/**
 * Escalate-only merge: returns the MORE urgent of two levels.
 * INSUFFICIENT_INFO (rank 0) never wins against a real level.
 * This is the safety invariant — rules can only escalate ML output, never downgrade.
 */
export function escalate(a: UrgencyLevel, b: UrgencyLevel): UrgencyLevel {
  return rankOf(a) >= rankOf(b) ? a : b;
}
