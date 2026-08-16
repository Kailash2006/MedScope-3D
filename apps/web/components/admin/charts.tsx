"use client";

// Self-contained SVG chart primitives for the admin dashboard (no chart lib).
// Marks are thin with rounded ends; values/labels use text tokens, color carries
// identity (with a label always present); every series is legend-labeled.

export function StatTile({
  label, value, sub, accent = "var(--accent-2)", icon,
}: { label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="glass stat">
      <span className="stat-bar" style={{ background: accent }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="stat-label">{label}</span>
        {icon && <span aria-hidden style={{ color: accent, opacity: 0.9, fontSize: "1rem" }}>{icon}</span>}
      </div>
      <div className="stat-value" style={{ color: accent }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// Radial gauge (0–1) — used for average confidence.
export function Gauge({ value, color = "var(--accent)", label }: { value: number; color?: string; label?: string }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: "relative", width: 132, height: 132 }}>
      <svg width={132} height={132} viewBox="0 0 120 120" role="img" aria-label={`${label ?? "Value"} ${(pct * 100).toFixed(0)} percent`}>
        <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth={10} />
        <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: "1.7rem", fontWeight: 700, lineHeight: 1 }}>{(pct * 100).toFixed(0)}<span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>%</span></div>
          {label && <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 4, letterSpacing: ".04em" }}>{label}</div>}
        </div>
      </div>
    </div>
  );
}

// Donut with a legend. data: [{label, value, color}]. Rounded ends, 2px gaps.
export function Donut({
  data, centerLabel, centerValue,
}: { data: { label: string; value: number; color: string }[]; centerLabel: string; centerValue: string }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  const r = 52, cx = 70, cy = 70, circ = 2 * Math.PI * r;
  let offset = 0;
  const segs = data.filter((d) => d.value > 0).map((d) => {
    const frac = d.value / total;
    const seg = { ...d, dash: frac * circ, offset };
    offset += frac * circ;
    return seg;
  });
  return (
    <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
        <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={16} />
          {segs.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={16} strokeLinecap="round"
              strokeDasharray={`${Math.max(0, s.dash - 3)} ${circ - Math.max(0, s.dash - 3)}`}
              strokeDashoffset={-s.offset} transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray .8s ease" }} />
          ))}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1 }}>{centerValue}</div>
            <div style={{ fontSize: "0.66rem", color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>{centerLabel}</div>
          </div>
        </div>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: ".4rem", flex: 1, minWidth: 150 }}>
        {data.map((d) => (
          <li key={d.label} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: ".5rem", fontSize: ".82rem" }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: d.color, boxShadow: `0 0 8px ${d.color}66` }} />
            <span style={{ color: "var(--text)" }}>{d.label}</span>
            <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {d.value} <span style={{ color: "var(--muted-2)" }}>· {((d.value / total) * 100).toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Horizontal bar list. data: [{label, value, color}]. Rounded ends, direct values.
export function BarList({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "grid", gap: ".6rem" }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "150px 1fr auto", alignItems: "center", gap: ".6rem", fontSize: ".82rem" }}>
          <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>{d.label}</span>
          <span style={{ height: 12, background: "rgba(148,163,184,0.1)", borderRadius: 6, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 8 : 0, background: d.color, borderRadius: 6, boxShadow: `0 0 10px ${d.color}55`, transition: "width .7s cubic-bezier(.2,.8,.2,1)" }} />
          </span>
          <span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// Animated ECG monitor line — decorative "system vitals" banner.
export function Heartbeat({ color = "var(--u-routine)" }: { color?: string }) {
  // One ECG period; the group scrolls left for a live-monitor sweep.
  const beat = "0,20 30,20 38,20 44,6 50,34 56,14 62,20 90,20 98,20 104,8 110,30 116,20 150,20";
  return (
    <div className="ecg" aria-hidden style={{ height: 56 }}>
      <svg width="100%" height="56" viewBox="0 0 300 40" preserveAspectRatio="none">
        <g className="ecg-scroll" style={{ ["--ecg" as string]: color } as React.CSSProperties}>
          {[0, 150, 300, 450].map((x) => (
            <polyline key={x} points={beat} transform={`translate(${x} 0)`} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </g>
      </svg>
    </div>
  );
}
