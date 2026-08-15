"use client";

import type { Action } from "../../lib/triageState";
import type { Sex, TriageState } from "../../lib/types";

export function Demographics({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  return (
    <fieldset className="glass" style={{ padding: "1.1rem" }}>
      <legend className="card-title">About you</legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
        <div>
          <label htmlFor="age" className="field-label">Age (years)</label>
          <input
            id="age" className="input" type="number" min={0} max={130} inputMode="numeric"
            value={state.age ?? ""}
            onChange={(e) => dispatch({ type: "setAge", age: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor="sex" className="field-label">Sex</label>
          <select
            id="sex" className="input" value={state.sex ?? ""}
            onChange={(e) => dispatch({ type: "setSex", sex: (e.target.value || null) as Sex | null })}
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
