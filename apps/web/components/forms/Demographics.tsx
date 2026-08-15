"use client";

import type { Action } from "../../lib/triageState";
import type { Sex, TriageState } from "../../lib/types";
import { Select } from "../Select";

export function Demographics({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">About you</legend>
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
          <Select
            id="sex"
            ariaLabel="Sex"
            value={state.sex ?? ""}
            placeholder="Prefer not to say"
            options={[
              { value: "", label: "Prefer not to say" },
              { value: "M", label: "Male" },
              { value: "F", label: "Female" },
              { value: "O", label: "Other" },
            ]}
            onChange={(v) => dispatch({ type: "setSex", sex: (v || null) as Sex | null })}
          />
        </div>
      </div>
    </fieldset>
  );
}
