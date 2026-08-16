"use client";

import { useState } from "react";
import type { Action } from "../lib/triageState";
import type { TriageState } from "../lib/types";

interface Effect {
  symptoms?: { code: string; severity: number }[];
  regions?: string[];
  risk_factors?: string[];
}
interface FollowUp {
  id: string;
  when: { regions?: string[]; symptoms?: string[] };
  q: string;
  yes: Effect;
}

// Region/symptom-driven red-flag questions. Every effect maps to the existing
// vocabulary, so a "Yes" feeds the deterministic safety engine and can change the
// urgency — transparently. Ordered by clinical importance.
export const FOLLOWUPS: FollowUp[] = [
  // Chest → cardiac / airway
  { id: "chest-pain", when: { regions: ["chest_left", "chest_right"] }, q: "Chest pain, pressure, or tightness?", yes: { symptoms: [{ code: "chest_pain", severity: 7 }] } },
  { id: "chest-radiate", when: { symptoms: ["chest_pain"] }, q: "Does it spread to your arm, jaw, or back?", yes: { regions: ["arm_left", "jaw"] } },
  { id: "chest-sob", when: { symptoms: ["chest_pain"], regions: ["chest_left", "chest_right"] }, q: "Are you short of breath?", yes: { symptoms: [{ code: "difficulty_breathing", severity: 6 }] } },
  { id: "chest-risk", when: { symptoms: ["chest_pain"] }, q: "History of high blood pressure, diabetes, or smoking?", yes: { risk_factors: ["hypertension"] } },

  // Head → stroke / meningitis / thunderclap
  { id: "head-worst", when: { regions: ["head"], symptoms: ["headache"] }, q: "Worst or most sudden headache of your life?", yes: { symptoms: [{ code: "headache", severity: 9 }] } },
  { id: "head-neck", when: { regions: ["head"], symptoms: ["headache"] }, q: "Do you have a stiff neck?", yes: { symptoms: [{ code: "neck_stiffness", severity: 6 }] } },
  { id: "head-fever", when: { symptoms: ["headache", "neck_stiffness"] }, q: "Do you have a fever?", yes: { symptoms: [{ code: "fever", severity: 6 }] } },
  { id: "stroke-face", when: { regions: ["head"], symptoms: ["headache", "unilateral_weakness", "speech_difficulty"] }, q: "Is one side of your face drooping?", yes: { symptoms: [{ code: "facial_droop", severity: 8 }] } },
  { id: "stroke-speech", when: { regions: ["head"], symptoms: ["facial_droop", "unilateral_weakness"] }, q: "Is your speech slurred or hard to get out?", yes: { symptoms: [{ code: "speech_difficulty", severity: 8 }] } },
  { id: "stroke-weak", when: { regions: ["head", "arm_left", "arm_right", "leg_left", "leg_right"], symptoms: ["facial_droop", "speech_difficulty"] }, q: "Weakness or numbness on one side of your body?", yes: { symptoms: [{ code: "unilateral_weakness", severity: 8 }] } },

  // Breathing → anaphylaxis
  { id: "breath-swell", when: { symptoms: ["difficulty_breathing"] }, q: "Any swelling of your lips, tongue, or throat?", yes: { symptoms: [{ code: "swelling", severity: 7 }] } },
  { id: "breath-allergen", when: { symptoms: ["swelling", "difficulty_breathing"] }, q: "Recent exposure to a known allergen (food, sting, medication)?", yes: { risk_factors: ["known_allergen_exposure"] } },

  // Abdomen → pregnancy / vomiting
  { id: "abdo-severe", when: { regions: ["abdomen"] }, q: "Severe abdominal pain?", yes: { symptoms: [{ code: "abdominal_pain", severity: 7 }] } },
  { id: "abdo-vomit", when: { regions: ["abdomen"], symptoms: ["abdominal_pain"] }, q: "Are you vomiting?", yes: { symptoms: [{ code: "vomiting", severity: 5 }] } },
  { id: "abdo-preg", when: { regions: ["abdomen"], symptoms: ["abdominal_pain"] }, q: "Is there any chance you are pregnant?", yes: { risk_factors: ["pregnancy"] } },
];

function satisfied(fu: FollowUp, state: TriageState): boolean {
  const codes = new Set(state.symptoms.map((s) => s.code));
  const regions = new Set(state.regions as string[]);
  const risks = new Set(state.riskFactors);
  const okSym = (fu.yes.symptoms ?? []).every((s) => codes.has(s.code));
  const okReg = (fu.yes.regions ?? []).every((r) => regions.has(r));
  const okRisk = (fu.yes.risk_factors ?? []).every((r) => risks.has(r));
  return okSym && okReg && okRisk;
}

function applicable(fu: FollowUp, state: TriageState): boolean {
  const codes = new Set(state.symptoms.map((s) => s.code));
  const regions = new Set(state.regions as string[]);
  const regionHit = (fu.when.regions ?? []).some((r) => regions.has(r));
  const symHit = (fu.when.symptoms ?? []).some((s) => codes.has(s));
  return regionHit || symHit;
}

/** Questions to show: applicable, not already satisfied, not answered/dismissed. */
export function visibleQuestions(state: TriageState, answered: Set<string>, limit = 3): FollowUp[] {
  return FOLLOWUPS.filter((fu) => !answered.has(fu.id) && applicable(fu, state) && !satisfied(fu, state)).slice(0, limit);
}

export function RedFlagQuestions({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const visible = visibleQuestions(state, answered);
  if (visible.length === 0) return null;

  function mark(id: string) {
    setAnswered((prev) => new Set(prev).add(id));
  }
  function yes(fu: FollowUp) {
    dispatch({
      type: "applyExtracted",
      data: {
        symptoms: (fu.yes.symptoms ?? []).map((s) => ({ code: s.code, severity: s.severity, duration_hours: null })),
        regions: fu.yes.regions ?? [],
        risk_factors: fu.yes.risk_factors ?? [],
        vitals: {},
      },
    });
    mark(fu.id);
  }

  return (
    <div className="glass" style={{ padding: "1.1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".6rem" }}>
        <span aria-hidden style={{ fontSize: "1rem" }}>⚑</span>
        <p className="card-title" style={{ margin: 0 }}>A few quick checks</p>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".8rem", margin: "0 0 .8rem" }}>
        Based on what you selected — your answers refine the urgency instantly.
      </p>
      <div style={{ display: "grid", gap: ".6rem" }}>
        {visible.map((fu) => (
          <div key={fu.id} className="glass-inset pop" style={{ padding: ".7rem .8rem", display: "grid", gap: ".55rem" }}>
            <span style={{ fontSize: ".88rem", lineHeight: 1.35 }}>{fu.q}</span>
            <div style={{ display: "flex", gap: ".5rem" }}>
              <button type="button" className="btn btn-primary" style={{ padding: ".4rem .9rem", fontSize: ".85rem" }} onClick={() => yes(fu)}>Yes</button>
              <button type="button" className="btn" style={{ padding: ".4rem .9rem", fontSize: ".85rem" }} onClick={() => mark(fu.id)}>No</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
