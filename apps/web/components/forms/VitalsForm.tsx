"use client";

import type { Action } from "../../lib/triageState";
import type { TriageState, Vitals } from "../../lib/types";
import { VITAL_FIELDS } from "../../lib/vocab";

const inputStyle = { width: "100%", padding: ".4rem", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e5e7eb" };

export function VitalsForm({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  return (
    <fieldset style={{ border: "1px solid #1e293b", borderRadius: 10, padding: "1rem" }}>
      <legend style={{ padding: "0 .4rem", color: "#cbd5e1" }}>Vitals (optional)</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: ".75rem" }}>
        {VITAL_FIELDS.map((v) => {
          const cur = state.vitals[v.key as keyof Vitals];
          return (
            <div key={v.key}>
              <label htmlFor={`vital-${v.key}`} style={{ display: "block", fontSize: ".78rem", color: "#94a3b8", marginBottom: ".2rem" }}>
                {v.label} <span style={{ color: "#94a3b8" }}>({v.unit})</span>
              </label>
              <input
                id={`vital-${v.key}`} type="number" min={v.min} max={v.max} inputMode="decimal"
                value={cur ?? ""}
                onChange={(e) => dispatch({ type: "setVital", key: v.key as keyof Vitals, value: e.target.value === "" ? null : Number(e.target.value) })}
                style={inputStyle}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
