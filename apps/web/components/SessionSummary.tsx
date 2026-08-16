"use client";

import type { TriageState } from "../lib/types";
import { humanize } from "../lib/vocab";
import { REGION_LABEL } from "../lib/regions";

const SEX_LABEL: Record<string, string> = { M: "Male", F: "Female", O: "Other" };
const VITAL_META: Record<string, { label: string; unit: string }> = {
  hr: { label: "Heart rate", unit: "bpm" },
  sbp: { label: "Systolic", unit: "mmHg" },
  dbp: { label: "Diastolic", unit: "mmHg" },
  spo2: { label: "SpO₂", unit: "%" },
  temp_c: { label: "Temp", unit: "°C" },
  rr: { label: "Resp. rate", unit: "/min" },
};

function Tile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="glass-inset" style={{ padding: ".7rem .8rem", display: "grid", gap: ".15rem" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", fontSize: ".68rem", color: "var(--muted)" }}>
        <span aria-hidden className="sum-ico">{icon}</span> {label}
      </span>
      <span style={{ fontSize: "1.02rem", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function SessionSummary({ state }: { state: TriageState }) {
  const vitals = Object.entries(state.vitals).filter(([, v]) => v != null) as [string, number][];
  const nothing = !state.age && !state.sex && state.symptoms.length === 0 && state.regions.length === 0 && state.riskFactors.length === 0 && vitals.length === 0;

  return (
    <aside className="glass" style={{ padding: "1.2rem", display: "grid", gap: "1.1rem" }} aria-label="Session summary">
      <div style={{ display: "flex", alignItems: "center", gap: ".7rem" }}>
        <span aria-hidden style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent)", display: "grid", placeItems: "center", color: "#fff", fontSize: "1.2rem", flexShrink: 0 }}>◍</span>
        <div>
          <p className="card-title" style={{ margin: 0 }}>Session</p>
          <p style={{ margin: ".1rem 0 0", fontSize: "1.05rem", fontWeight: 700 }}>Anonymous patient</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
        <Tile icon="⏳" label="Age" value={state.age != null ? `${state.age} yrs` : "—"} />
        <Tile icon="⚧" label="Sex" value={state.sex ? SEX_LABEL[state.sex] : "—"} />
      </div>

      {nothing ? (
        <p style={{ color: "var(--muted-2)", fontSize: ".85rem", margin: 0, lineHeight: 1.5 }}>
          Describe symptoms in the centre, tap the 3D body, or fill the intake tabs — this chart updates live.
        </p>
      ) : (
        <>
          {state.symptoms.length > 0 && (
            <div>
              <p className="card-title" style={{ margin: "0 0 .5rem" }}>Symptoms</p>
              <div style={{ display: "grid", gap: ".4rem" }}>
                {state.symptoms.map((s) => (
                  <div key={s.code} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: ".5rem", fontSize: ".86rem" }}>
                    <span>{humanize(s.code)}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", color: "var(--muted)" }}>
                      <span style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(148,163,184,0.18)", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${s.severity * 10}%`, background: "var(--accent)" }} />
                      </span>
                      {s.severity}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.regions.length > 0 && (
            <div>
              <p className="card-title" style={{ margin: "0 0 .45rem" }}>Regions</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                {state.regions.map((r) => (
                  <span key={r} className="glass-inset" style={{ padding: ".25rem .55rem", fontSize: ".76rem" }}>{REGION_LABEL[r] ?? humanize(r)}</span>
                ))}
              </div>
            </div>
          )}

          {state.riskFactors.length > 0 && (
            <div>
              <p className="card-title" style={{ margin: "0 0 .45rem" }}>Risk factors</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                {state.riskFactors.map((r) => (
                  <span key={r} className="glass-inset" style={{ padding: ".25rem .55rem", fontSize: ".76rem", color: "var(--u-doctor)" }}>{humanize(r)}</span>
                ))}
              </div>
            </div>
          )}

          {vitals.length > 0 && (
            <div>
              <p className="card-title" style={{ margin: "0 0 .5rem" }}>Vitals</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem" }}>
                {vitals.map(([k, v]) => (
                  <Tile key={k} icon="❤" label={VITAL_META[k]?.label ?? k} value={`${v} ${VITAL_META[k]?.unit ?? ""}`.trim()} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
