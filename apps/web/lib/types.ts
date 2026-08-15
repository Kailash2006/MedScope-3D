import type { RegionCode } from "./regions";

export type Sex = "M" | "F" | "O";

export interface SymptomEntry {
  code: string;
  severity: number; // 0..10
  duration_hours?: number | null;
}

export interface Vitals {
  hr?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  spo2?: number | null;
  temp_c?: number | null;
  rr?: number | null;
}

export interface TriageState {
  age: number | null;
  sex: Sex | null;
  regions: RegionCode[];
  symptoms: SymptomEntry[];
  riskFactors: string[];
  vitals: Vitals;
}

export interface Reason {
  type: string;
  rule: string | null;
  message: string;
}

export interface Assessment {
  urgency: string;
  confidence: number;
  reasons: Reason[];
  decision_path: string;
  advice: string;
  model_version: string;
  engine_version: string;
  disclaimer: string;
  age_band?: string | null;
  assessed_at: string;
}

export const emptyState = (): TriageState => ({
  age: null,
  sex: null,
  regions: [],
  symptoms: [],
  riskFactors: [],
  vitals: {},
});
