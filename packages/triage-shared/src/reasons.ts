export type DecisionPath =
  | "VITALS_RED_FLAG"
  | "SYMPTOM_RED_FLAG"
  | "ML"
  | "FALLBACK_LOW_CONF"
  | "FALLBACK_MISSING"
  | "FALLBACK_MODEL_ERROR";

export type ReasonType = "RED_FLAG" | "ML" | "FALLBACK" | "INFO";

export interface Reason {
  type: ReasonType;
  /** Rule id from redflags.table.json, or null for ML/INFO reasons. */
  rule: string | null;
  message: string;
}

export const DISCLAIMER =
  "Research/education prototype. Not a diagnosis. Not medical advice. " +
  "Red-flag thresholds are simplified triage-education defaults, not validated clinical cut-offs.";
