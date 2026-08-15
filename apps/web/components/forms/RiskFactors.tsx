"use client";

import type { Action } from "../../lib/triageState";
import type { TriageState } from "../../lib/types";
import { RISK_CODES, humanize } from "../../lib/vocab";

export function RiskFactors({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  return (
    <fieldset style={{ border: "1px solid #1e293b", borderRadius: 10, padding: "1rem" }}>
      <legend style={{ padding: "0 .4rem", color: "#cbd5e1" }}>Risk factors</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem 1rem" }}>
        {RISK_CODES.map((code) => (
          <label key={code} style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: ".88rem" }}>
            <input
              type="checkbox"
              checked={state.riskFactors.includes(code)}
              onChange={() => dispatch({ type: "toggleRisk", code })}
            />
            {humanize(code)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
