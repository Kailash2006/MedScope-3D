"use client";

import { useEffect, useState } from "react";
import { getTimeline, reportUrl, type TimelinePoint } from "../lib/api";
import { urgencyColor, urgencyLabel } from "../lib/urgency";
import { VitalsChart } from "./charts/VitalsChart";

interface Props {
  sessionId: string | null;
  refreshKey: number;
}

const CHARTS: { key: string; title: string; unit: string; color: string }[] = [
  { key: "spo2", title: "SpO₂", unit: "%", color: "#38bdf8" },
  { key: "hr", title: "Heart rate", unit: "bpm", color: "#f472b6" },
  { key: "temp_c", title: "Temperature", unit: "°C", color: "#fb923c" },
];

export function HistoryPanel({ sessionId, refreshKey }: Props) {
  const [points, setPoints] = useState<TimelinePoint[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getTimeline(sessionId)
      .then((p) => { if (!cancelled) setPoints(p); })
      .catch(() => { /* ignore transient errors */ });
    return () => { cancelled = true; };
  }, [sessionId, refreshKey]);

  return (
    <section aria-labelledby="history-heading" className="glass" style={{ padding: "1.1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
        <h2 id="history-heading" style={{ fontSize: "1.05rem", margin: 0 }}>History &amp; report</h2>
        {sessionId && (
          <a
            href={reportUrl(sessionId)}
            target="_blank"
            rel="noreferrer"
            className="chip" style={{ fontSize: ".82rem", textDecoration: "none" }}
          >
            ⬇ Clinician PDF
          </a>
        )}
      </div>

      {points.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: ".85rem", margin: 0 }}>
          No history yet — changes autosave and appear here.
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: ".75rem", marginBottom: ".75rem" }}>
            {CHARTS.map((c) => (
              <VitalsChart
                key={c.key}
                title={c.title}
                unit={c.unit}
                color={c.color}
                series={points.map((p) => ({ t: p.at, v: (p.vitals?.[c.key] ?? null) as number | null }))}
              />
            ))}
          </div>

          <h3 style={{ fontSize: ".85rem", color: "#94a3b8", margin: ".5rem 0 .35rem" }}>Urgency timeline</h3>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: ".3rem", maxHeight: 200, overflowY: "auto" }}>
            {points.slice().reverse().map((p, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".8rem" }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: urgencyColor(p.urgency), flexShrink: 0 }} />
                <span style={{ color: "#cbd5e1", minWidth: 96 }}>{new Date(p.at).toLocaleTimeString()}</span>
                <span style={{ color: urgencyColor(p.urgency), fontWeight: 600 }}>{urgencyLabel(p.urgency)}</span>
                <span style={{ color: "#94a3b8" }}>· {p.decision_path}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
