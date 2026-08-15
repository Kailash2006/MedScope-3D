"use client";

import type { Action } from "../../lib/triageState";
import type { Sex, TriageState } from "../../lib/types";

const labelStyle = { display: "block", fontSize: ".8rem", color: "#94a3b8", marginBottom: ".2rem" };
const inputStyle = { width: "100%", padding: ".45rem", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e5e7eb" };

export function Demographics({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  return (
    <fieldset style={{ border: "1px solid #1e293b", borderRadius: 10, padding: "1rem" }}>
      <legend style={{ padding: "0 .4rem", color: "#cbd5e1" }}>About you</legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
        <div>
          <label htmlFor="age" style={labelStyle}>Age (years)</label>
          <input
            id="age" type="number" min={0} max={130} inputMode="numeric"
            value={state.age ?? ""}
            onChange={(e) => dispatch({ type: "setAge", age: e.target.value === "" ? null : Number(e.target.value) })}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="sex" style={labelStyle}>Sex</label>
          <select
            id="sex" value={state.sex ?? ""}
            onChange={(e) => dispatch({ type: "setSex", sex: (e.target.value || null) as Sex | null })}
            style={inputStyle}
          >
            <option value="">Prefer not to say</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </div>
      </div>
    </fieldset>
  );
}
