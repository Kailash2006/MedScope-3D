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

function Gauge({ value, color }: { value: number; color: string }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: "relative", width: 58, height: 58, flexShrink: 0 }}>
      <svg width={58} height={58} viewBox="0 0 60 60" role="img" aria-label={`Confidence ${(pct * 100).toFixed(0)} percent`}>
        <circle cx={30} cy={30} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} transform="rotate(-90 30 30)"
          style={{ transition: "stroke-dashoffset .6s ease", filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: ".76rem", fontWeight: 700 }}>
        {(pct * 100).toFixed(0)}%
      </div>
    </div>
  );
}

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
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".6rem", minWidth: 0 }}>
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", background: color, color, boxShadow: `0 0 22px ${color}`, animation: "haloPulse 1.8s ease-in-out infinite", flexShrink: 0 }} />
                  <strong key={assessment.urgency} className="pop" style={{ fontSize: "1.6rem", color, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{urgencyLabel(assessment.urgency)}</strong>
                </div>
                <Gauge value={assessment.confidence} color={color} />
              </div>
              {assessment.advice && <p style={{ margin: ".65rem 0 .3rem", color: "var(--text)", fontSize: ".95rem" }}>{assessment.advice}</p>}

              <dl style={{ margin: ".6rem 0 .2rem", fontSize: ".8rem", color: "var(--muted)", display: "grid", gridTemplateColumns: "auto 1fr", gap: ".22rem .7rem" }}>
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
