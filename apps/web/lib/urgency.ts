import { labelOf, type UrgencyLevel } from "@medscope/triage-shared";

export const URGENCY_COLOR: Record<string, string> = {
  EMERGENCY: "#ef4444",
  URGENT_TODAY: "#f97316",
  DOCTOR_SOON: "#eab308",
  ROUTINE: "#22c55e",
  SELF_CARE: "#38bdf8",
  INSUFFICIENT_INFO: "#94a3b8",
};

export function urgencyColor(level: string): string {
  return URGENCY_COLOR[level] ?? "#64748b";
}

export function urgencyLabel(level: string): string {
  return labelOf(level as UrgencyLevel);
}

export const DECISION_PATH_LABEL: Record<string, string> = {
  VITALS_RED_FLAG: "Vitals red flag",
  SYMPTOM_RED_FLAG: "Symptom red flag",
  ML: "ML model",
  FALLBACK_LOW_CONF: "Low-confidence fallback",
  FALLBACK_MISSING: "Insufficient information",
  FALLBACK_MODEL_ERROR: "Conservative fallback",
};
