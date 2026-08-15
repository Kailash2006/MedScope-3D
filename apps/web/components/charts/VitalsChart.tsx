"use client";

interface Point {
  t: string;
  v: number | null;
}

interface Props {
  title: string;
  unit: string;
  series: Point[];
  color?: string;
}

// Minimal dependency-free line chart (SVG). Plots the non-null values of one
// vital over time. Accessible: labelled group + a text summary of the latest.
export function VitalsChart({ title, unit, series, color = "#38bdf8" }: Props) {
  const pts = series.map((p, i) => ({ i, v: p.v })).filter((p) => p.v !== null) as { i: number; v: number }[];
  const W = 240;
  const H = 70;
  const pad = 6;

  let body: React.ReactNode;
  let latest = "—";

  if (pts.length === 0) {
    body = <text x={W / 2} y={H / 2} textAnchor="middle" fill="#64748b" fontSize="10">no data</text>;
  } else {
    const vals = pts.map((p) => p.v);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const n = series.length;
    const x = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
    const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
    const d = pts.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    latest = `${vals[vals.length - 1]} ${unit}`;
    body = (
      <>
        {pts.length > 1 && <polyline points={d} fill="none" stroke={color} strokeWidth={1.5} />}
        {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2} fill={color} />)}
        <text x={pad} y={10} fill="#64748b" fontSize="8">{max}</text>
        <text x={pad} y={H - 1} fill="#64748b" fontSize="8">{min}</text>
      </>
    );
  }

  return (
    <figure style={{ margin: 0 }} aria-label={`${title} over time, latest ${latest}`}>
      <figcaption style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", color: "#94a3b8" }}>
        <span>{title}</span>
        <span style={{ color: "#e2e8f0" }}>{latest}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", height: "auto", background: "#0b1120", borderRadius: 8 }}>
        {body}
      </svg>
    </figure>
  );
}
