"use client";

import { useState } from "react";
import type { Action } from "../lib/triageState";
import type { TriageState } from "../lib/types";
import { Demographics } from "./forms/Demographics";
import { SymptomForm } from "./forms/SymptomForm";
import { VitalsForm } from "./forms/VitalsForm";
import { RiskFactors } from "./forms/RiskFactors";

type TabKey = "about" | "symptoms" | "vitals" | "risk";

// A single app-like console: one glass panel, a tab rail with live "filled"
// badges, and an animated section body — instead of a stack of identical cards.
export function IntakeConsole({ state, dispatch }: { state: TriageState; dispatch: (a: Action) => void }) {
  const [tab, setTab] = useState<TabKey>("symptoms");

  const vitalsFilled = Object.values(state.vitals).filter((v) => v != null).length;
  const badges: Record<TabKey, number | boolean> = {
    about: state.age != null || !!state.sex,
    symptoms: state.symptoms.length,
    vitals: vitalsFilled,
    risk: state.riskFactors.length,
  };

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "about", label: "About you", icon: "◍" },
    { key: "symptoms", label: "Symptoms", icon: "✚" },
    { key: "vitals", label: "Vitals", icon: "❤" },
    { key: "risk", label: "Risk", icon: "⚠" },
  ];

  return (
    <section className="glass intake" aria-label="Symptom intake">
      <div className="intake-rail" role="tablist" aria-label="Intake sections">
        {TABS.map((t) => {
          const b = badges[t.key];
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              className="intake-tab"
              data-active={active}
              onClick={() => setTab(t.key)}
            >
              <span className="intake-tab-icon" aria-hidden>{t.icon}</span>
              <span className="intake-tab-label">{t.label}</span>
              {b ? <span className="intake-badge">{typeof b === "number" ? b : "•"}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="intake-panel" key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "about" && <Demographics state={state} dispatch={dispatch} />}
        {tab === "symptoms" && <SymptomForm state={state} dispatch={dispatch} />}
        {tab === "vitals" && <VitalsForm state={state} dispatch={dispatch} />}
        {tab === "risk" && <RiskFactors state={state} dispatch={dispatch} />}
      </div>
    </section>
  );
}
