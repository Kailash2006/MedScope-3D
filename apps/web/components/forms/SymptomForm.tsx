"use client";

import { useState } from "react";
import type { Action } from "../../lib/triageState";
import type { TriageState } from "../../lib/types";
import { SYMPTOM_CODES, humanize } from "../../lib/vocab";

const inputStyle = { padding: ".4rem", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e5e7eb" };

export function SymptomForm({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  const [pick, setPick] = useState("");
  const available = SYMPTOM_CODES.filter((c) => !state.symptoms.some((s) => s.code === c));

  return (
    <fieldset style={{ border: "1px solid #1e293b", borderRadius: 10, padding: "1rem" }}>
      <legend style={{ padding: "0 .4rem", color: "#cbd5e1" }}>Symptoms</legend>

      <div style={{ display: "flex", gap: ".5rem", marginBottom: ".75rem" }}>
        <label htmlFor="add-symptom" style={{ position: "absolute", left: -9999 }}>Add a symptom</label>
        <select id="add-symptom" value={pick} onChange={(e) => setPick(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Add a symptom…</option>
          {available.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
        </select>
        <button
          type="button"
          disabled={!pick}
          onClick={() => { dispatch({ type: "addSymptom", code: pick }); setPick(""); }}
          style={{ ...inputStyle, cursor: pick ? "pointer" : "not-allowed", background: pick ? "#0ea5e9" : "#1e293b", color: pick ? "#001018" : "#64748b", border: "none" }}
        >
          Add
        </button>
      </div>

      {state.symptoms.length === 0 && <p style={{ color: "#64748b", fontSize: ".85rem", margin: 0 }}>No symptoms added yet.</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: ".75rem" }}>
        {state.symptoms.map((s, i) => (
          <li key={s.code} style={{ border: "1px solid #1e293b", borderRadius: 8, padding: ".6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: ".92rem" }}>{humanize(s.code)}</strong>
              <button type="button" onClick={() => dispatch({ type: "removeSymptom", index: i })}
                aria-label={`Remove ${humanize(s.code)}`}
                style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
            </div>
            <label htmlFor={`sev-${s.code}`} style={{ display: "block", fontSize: ".78rem", color: "#94a3b8", marginTop: ".4rem" }}>
              Severity: {s.severity}/10
            </label>
            <input
              id={`sev-${s.code}`} type="range" min={0} max={10} value={s.severity}
              onChange={(e) => dispatch({ type: "updateSymptom", index: i, patch: { severity: Number(e.target.value) } })}
              style={{ width: "100%" }}
            />
            <label htmlFor={`dur-${s.code}`} style={{ display: "block", fontSize: ".78rem", color: "#94a3b8" }}>Duration (hours)</label>
            <input
              id={`dur-${s.code}`} type="number" min={0} value={s.duration_hours ?? ""}
              onChange={(e) => dispatch({ type: "updateSymptom", index: i, patch: { duration_hours: e.target.value === "" ? null : Number(e.target.value) } })}
              style={{ ...inputStyle, width: "8rem" }}
            />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
