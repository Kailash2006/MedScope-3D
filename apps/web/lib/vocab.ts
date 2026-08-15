import { featureContract } from "@medscope/triage-shared";

const mh = (featureContract as { multihot_features: Record<string, string[]> }).multihot_features;

export const SYMPTOM_CODES: string[] = mh.symptom_codes;
export const RISK_CODES: string[] = mh.risk_factors;

export function humanize(code: string): string {
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const VITAL_FIELDS: { key: string; label: string; unit: string; min: number; max: number }[] = [
  { key: "hr", label: "Heart rate", unit: "bpm", min: 20, max: 250 },
  { key: "sbp", label: "Systolic BP", unit: "mmHg", min: 50, max: 260 },
  { key: "dbp", label: "Diastolic BP", unit: "mmHg", min: 20, max: 200 },
  { key: "spo2", label: "SpO₂", unit: "%", min: 50, max: 100 },
  { key: "temp_c", label: "Temperature", unit: "°C", min: 30, max: 44 },
  { key: "rr", label: "Resp. rate", unit: "/min", min: 4, max: 80 },
];
