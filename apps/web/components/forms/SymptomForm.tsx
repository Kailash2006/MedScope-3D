"use client";

import { useState } from "react";
import type { Action } from "../../lib/triageState";
import type { TriageState } from "../../lib/types";
import { SYMPTOM_CODES, humanize } from "../../lib/vocab";

export function SymptomForm({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  const [pick, setPick] = useState("");
  const available = SYMPTOM_CODES.filter((c) => !state.symptoms.some((s) => s.code === c));

  return (
    <fieldset className="glass" style={{ padding: "1.1rem" }}>
      <legend className="card-title">Symptoms</legend>

      <div style={{ display: "flex", gap: ".5rem", marginBottom: ".75rem" }}>
        <label htmlFor="add-symptom" style={{ position: "absolute", left: -9999 }}>Add a symptom</label>
        <select id="add-symptom" className="input" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
          <option value="">Add a symptom…</option>
          {available.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
        </select>
        <button type="button" className="btn btn-primary" disabled={!pick}
          onClick={() => { dispatch({ type: "addSymptom", code: pick }); setPick(""); }}
          style={{ opacity: pick ? 1 : 0.5 }}>
          Add
        </button>
      </div>

      {state.symptoms.length === 0 && <p style={{ color: "var(--muted-2)", fontSize: ".85rem", margin: 0 }}>No symptoms added yet.</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: ".6rem" }}>
        {state.symptoms.map((s, i) => (
          <li key={s.code} className="glass-inset" style={{ padding: ".7rem .8rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: ".92rem" }}>{humanize(s.code)}</strong>
              <button type="button" onClick={() => dispatch({ type: "removeSymptom", index: i })}
                aria-label={`Remove ${humanize(s.code)}`}
                style={{ background: "none", border: "none", color: "var(--u-emergency)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}>✕</button>
            </div>
            <label htmlFor={`sev-${s.code}`} style={{ display: "block", fontSize: ".74rem", color: "var(--muted)", marginTop: ".5rem" }}>
              Severity <span style={{ color: "var(--accent)", fontWeight: 600 }}>{s.severity}/10</span>
            </label>
            <input id={`sev-${s.code}`} type="range" min={0} max={10} value={s.severity}
              onChange={(e) => dispatch({ type: "updateSymptom", index: i, patch: { severity: Number(e.target.value) } })} />
            <label htmlFor={`dur-${s.code}`} style={{ display: "block", fontSize: ".74rem", color: "var(--muted)", marginTop: ".3rem" }}>Duration (hours)</label>
            <input id={`dur-${s.code}`} className="input" type="number" min={0} value={s.duration_hours ?? ""}
              onChange={(e) => dispatch({ type: "updateSymptom", index: i, patch: { duration_hours: e.target.value === "" ? null : Number(e.target.value) } })}
              style={{ width: "8rem", marginTop: ".2rem" }} />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
