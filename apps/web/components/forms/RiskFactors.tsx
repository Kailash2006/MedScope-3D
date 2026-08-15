"use client";

import type { Action } from "../../lib/triageState";
import type { TriageState } from "../../lib/types";
import { RISK_CODES, humanize } from "../../lib/vocab";

export function RiskFactors({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  return (
    <fieldset className="glass" style={{ padding: "1.1rem" }}>
      <legend className="card-title">Risk factors</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
        {RISK_CODES.map((code) => {
          const on = state.riskFactors.includes(code);
          return (
            <label key={code} className="chip chip-check" style={{ userSelect: "none", display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
              <input
                type="checkbox" checked={on}
                onChange={() => dispatch({ type: "toggleRisk", code })}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
              />
              {humanize(code)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
