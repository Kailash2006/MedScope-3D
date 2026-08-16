import type { RegionCode } from "./regions";
import type { Sex, SymptomEntry, TriageState, Vitals } from "./types";

export type Action =
  | { type: "toggleRegion"; code: RegionCode }
  | { type: "setAge"; age: number | null }
  | { type: "setSex"; sex: Sex | null }
  | { type: "addSymptom"; code: string }
  | { type: "updateSymptom"; index: number; patch: Partial<SymptomEntry> }
  | { type: "removeSymptom"; index: number }
  | { type: "toggleRisk"; code: string }
  | { type: "setVital"; key: keyof Vitals; value: number | null }
  | { type: "applyExtracted"; data: { symptoms: { code: string; severity: number; duration_hours: number | null }[]; regions: string[]; risk_factors: string[]; vitals: Record<string, number> } }
  | { type: "reset" };

export function reducer(state: TriageState, action: Action): TriageState {
  switch (action.type) {
    case "toggleRegion": {
      const has = state.regions.includes(action.code);
      return {
        ...state,
        regions: has
          ? state.regions.filter((r) => r !== action.code)
          : [...state.regions, action.code],
      };
    }
    case "setAge":
      return { ...state, age: action.age };
    case "setSex":
      return { ...state, sex: action.sex };
    case "addSymptom":
      if (!action.code || state.symptoms.some((s) => s.code === action.code)) return state;
      return { ...state, symptoms: [...state.symptoms, { code: action.code, severity: 5, duration_hours: null }] };
    case "updateSymptom":
      return {
        ...state,
        symptoms: state.symptoms.map((s, i) => (i === action.index ? { ...s, ...action.patch } : s)),
      };
    case "removeSymptom":
      return { ...state, symptoms: state.symptoms.filter((_, i) => i !== action.index) };
    case "toggleRisk": {
      const has = state.riskFactors.includes(action.code);
      return {
        ...state,
        riskFactors: has
          ? state.riskFactors.filter((r) => r !== action.code)
          : [...state.riskFactors, action.code],
      };
    }
    case "setVital":
      return { ...state, vitals: { ...state.vitals, [action.key]: action.value } };
    case "applyExtracted": {
      // Merge NL-extracted structured data: symptoms deduped by code (severity/
      // duration updated), regions + risks unioned, vitals overlaid.
      const byCode = new Map(state.symptoms.map((s) => [s.code, s]));
      for (const s of action.data.symptoms) {
        byCode.set(s.code, { code: s.code, severity: s.severity, duration_hours: s.duration_hours });
      }
      return {
        ...state,
        symptoms: [...byCode.values()],
        regions: Array.from(new Set([...state.regions, ...(action.data.regions as RegionCode[])])),
        riskFactors: Array.from(new Set([...state.riskFactors, ...action.data.risk_factors])),
        vitals: { ...state.vitals, ...action.data.vitals },
      };
    }
    case "reset":
      return { age: null, sex: null, regions: [], symptoms: [], riskFactors: [], vitals: {} };
    default:
      return state;
  }
}

// Build the SessionUpdate/patch payload the API expects (drops null vitals).
export function toPatch(state: TriageState) {
  const vitals: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.vitals)) {
    if (v !== null && v !== undefined && !Number.isNaN(v)) vitals[k] = v;
  }
  return {
    age: state.age,
    sex: state.sex,
    regions: state.regions,
    risk_factors: state.riskFactors,
    symptoms: state.symptoms.map((s) => ({
      code: s.code,
      severity: s.severity,
      duration_hours: s.duration_hours ?? null,
    })),
    vitals,
  };
}
