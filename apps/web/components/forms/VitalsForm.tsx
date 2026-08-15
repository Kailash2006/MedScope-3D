"use client";

import type { Action } from "../../lib/triageState";
import type { TriageState, Vitals } from "../../lib/types";
import { VITAL_FIELDS } from "../../lib/vocab";

export function VitalsForm({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Vitals · optional</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: ".7rem" }}>
        {VITAL_FIELDS.map((v) => {
          const cur = state.vitals[v.key as keyof Vitals];
          return (
            <div key={v.key}>
              <label htmlFor={`vital-${v.key}`} className="field-label" style={{ textTransform: "none", letterSpacing: 0 }}>
                {v.label} <span style={{ color: "var(--muted-2)" }}>{v.unit}</span>
              </label>
              <input
                id={`vital-${v.key}`} className="input" type="number" min={v.min} max={v.max} inputMode="decimal"
                value={cur ?? ""}
                onChange={(e) => dispatch({ type: "setVital", key: v.key as keyof Vitals, value: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
