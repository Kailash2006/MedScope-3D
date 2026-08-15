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
  connecting: "Connecting…",
  open: "Live",
  closed: "Reconnecting…",
  error: "Connection issue",
};

export function RiskPanel({ assessment, status, saved }: Props) {
  const color = assessment ? urgencyColor(assessment.urgency) : "#94a3b8";

  return (
    <aside className="risk-aside" aria-label="Urgency assessment" style={{ position: "sticky", top: "1rem" }}>
      <div style={{ border: `1px solid ${color}`, borderRadius: 12, padding: "1rem", background: "#0f172a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
          <span style={{ fontSize: ".75rem", color: "#94a3b8" }}>Urgency guidance</span>
          <span aria-live="polite" style={{ fontSize: ".72rem", color: status === "open" ? "#22c55e" : "#eab308" }}>
            ● {STATUS_TEXT[status]}{saved ? " · saved" : ""}
          </span>
        </div>

        <div aria-live="polite">
          {assessment ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", background: color }} />
                <strong style={{ fontSize: "1.4rem", color }}>{urgencyLabel(assessment.urgency)}</strong>
              </div>
              {assessment.advice && <p style={{ margin: ".4rem 0", color: "#e2e8f0" }}>{assessment.advice}</p>}
              <dl style={{ margin: ".5rem 0", fontSize: ".82rem", color: "#94a3b8", display: "grid", gridTemplateColumns: "auto 1fr", gap: ".2rem .6rem" }}>
                <dt>Basis</dt><dd style={{ margin: 0 }}>{DECISION_PATH_LABEL[assessment.decision_path] ?? assessment.decision_path}</dd>
                <dt>Confidence</dt><dd style={{ margin: 0 }}>{(assessment.confidence * 100).toFixed(0)}%</dd>
                <dt>Model</dt><dd style={{ margin: 0 }}>{assessment.model_version}</dd>
              </dl>
              {assessment.reasons.length > 0 && (
                <ul style={{ margin: ".25rem 0", paddingLeft: "1.1rem", fontSize: ".82rem", color: "#cbd5e1" }}>
                  {assessment.reasons.slice(0, 5).map((r, i) => <li key={i}>{r.message}</li>)}
                </ul>
              )}
            </>
          ) : (
            <p style={{ color: "#94a3b8" }}>Enter symptoms or vitals to see urgency guidance.</p>
          )}
        </div>
      </div>

      <p style={{ fontSize: ".72rem", color: "#94a3b8", marginTop: ".6rem", lineHeight: 1.5 }}>
        {assessment?.disclaimer ||
          "Research/education prototype. Not a diagnosis. Not medical advice."}
      </p>
    </aside>
  );
}
