"use client";

import { DECISION_PATH_LABEL, urgencyColor, urgencyLabel } from "../lib/urgency";
import type { Assessment } from "../lib/types";
import type { SocketStatus } from "../lib/ws";

interface Props {
  assessment: Assessment | null;
  status: SocketStatus;
  saved: boolean;
}

const STATUS_TEXT: Record<SocketStatus, string> = {
  connecting: "Connecting",
  open: "Live",
  closed: "Reconnecting",
  error: "Offline",
};

export function RiskPanel({ assessment, status, saved }: Props) {
  const color = assessment ? urgencyColor(assessment.urgency) : "var(--u-none)";
  const live = status === "open";

  return (
    <aside className="risk-aside rise rise-3" aria-label="Urgency assessment" style={{ position: "sticky", top: "1rem", display: "grid", gap: ".7rem" }}>
      <div
        className="glass"
        style={{
          padding: "1.2rem",
          position: "relative",
          overflow: "hidden",
          borderColor: assessment ? `${color}55` : "var(--border)",
        }}
      >
        {/* colored halo */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(90% 60% at 50% -10%, ${color}22, transparent 60%)`, pointerEvents: "none" }} />

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".7rem" }}>
          <span className="card-title" style={{ margin: 0 }}>Urgency guidance</span>
          <span aria-live="polite" style={{ fontSize: ".72rem", color: live ? "var(--u-routine)" : "var(--u-doctor)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="live-dot" style={{ background: live ? "var(--u-routine)" : "var(--u-doctor)" }} />
            {STATUS_TEXT[status]}{saved ? " · saved" : ""}
          </span>
        </div>

        <div aria-live="polite" style={{ position: "relative" }}>
          {assessment ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: ".7rem" }}>
                <span aria-hidden style={{ width: 16, height: 16, borderRadius: "50%", background: color, boxShadow: `0 0 20px ${color}` }} />
                <strong style={{ fontSize: "1.75rem", color, letterSpacing: "-0.02em" }}>{urgencyLabel(assessment.urgency)}</strong>
              </div>
              {assessment.advice && <p style={{ margin: ".5rem 0 .2rem", color: "var(--text)", fontSize: ".95rem" }}>{assessment.advice}</p>}

              {/* confidence meter */}
              <div style={{ margin: ".8rem 0 .4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".72rem", color: "var(--muted)" }}>
                  <span>Confidence</span><span>{(assessment.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginTop: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(4, assessment.confidence * 100)}%`, background: `linear-gradient(90deg, ${color}, var(--accent))`, borderRadius: 999 }} />
                </div>
              </div>

              <dl style={{ margin: ".5rem 0", fontSize: ".8rem", color: "var(--muted)", display: "grid", gridTemplateColumns: "auto 1fr", gap: ".22rem .7rem" }}>
                <dt>Basis</dt><dd style={{ margin: 0, color: "var(--text)" }}>{DECISION_PATH_LABEL[assessment.decision_path] ?? assessment.decision_path}</dd>
                <dt>Model</dt><dd style={{ margin: 0 }}>{assessment.model_version}</dd>
              </dl>

              {assessment.reasons.length > 0 && (
                <ul style={{ margin: ".3rem 0 0", paddingLeft: "1.1rem", fontSize: ".8rem", color: "var(--muted)" }}>
                  {assessment.reasons.slice(0, 5).map((r, i) => <li key={i}>{r.message}</li>)}
                </ul>
              )}
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>Add symptoms or vitals to see live urgency guidance.</p>
          )}
        </div>
      </div>

      <p style={{ fontSize: ".7rem", color: "var(--muted-2)", margin: 0, lineHeight: 1.5, padding: "0 .3rem" }}>
        {assessment?.disclaimer || "Research/education prototype. Not a diagnosis. Not medical advice."}
      </p>
    </aside>
  );
}
