"use client";

import { useCallback, useEffect, useState } from "react";
import { adminDashboard } from "../../lib/api";
import { urgencyColor, urgencyLabel } from "../../lib/urgency";

const TOKEN_KEY = "medscope_admin_token";

interface Dashboard {
  totals: { sessions: number; assessments: number };
  decision_path_distribution: Record<string, number>;
  urgency_distribution: Record<string, number>;
  safety: {
    red_flag_count: number;
    fallback_count: number;
    fallback_rate: number;
    red_flag_rate: number;
    avg_confidence: number | null;
  };
  model: { ready: boolean; model_version?: string };
  engine_version: string;
}

function Bars({ data, colorFor }: { data: Record<string, number>; colorFor?: (k: string) => string }) {
  const max = Math.max(1, ...Object.values(data));
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ display: "grid", gap: ".3rem" }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "150px 1fr 40px", alignItems: "center", gap: ".5rem", fontSize: ".82rem" }}>
          <span style={{ color: "#cbd5e1" }}>{k}</span>
          <span style={{ background: "#0f172a", borderRadius: 4, height: 14 }}>
            <span style={{ display: "block", height: "100%", width: `${(v / max) * 100}%`, background: colorFor?.(k) ?? "#38bdf8", borderRadius: 4 }} />
          </span>
          <span style={{ color: "#94a3b8", textAlign: "right" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #1e293b", borderRadius: 10, padding: ".75rem 1rem", background: "#0f172a" }}>
      <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback((t?: string) => {
    setLoading(true);
    setError(null);
    adminDashboard(t)
      .then((d) => { setData(d as unknown as Dashboard); if (t) localStorage.setItem(TOKEN_KEY, t); })
      .catch((e) => setError(e.message === "forbidden" ? "Invalid or missing admin credentials." : "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Prefer the logged-in admin account (JWT). Fall back to a saved shared token.
    setLoading(true);
    adminDashboard()
      .then((d) => setData(d as unknown as Dashboard))
      .catch(() => {
        const saved = localStorage.getItem(TOKEN_KEY);
        if (saved) { setToken(saved); load(saved); }
      })
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <main id="main" style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.6rem" }}>Admin — Safety Dashboard</h1>
      <p style={{ color: "#94a3b8", marginTop: 0 }}>Aggregate triage safety metrics. Restricted.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); load(token); }}
        style={{ display: "flex", gap: ".5rem", margin: "1rem 0" }}
      >
        <label htmlFor="admin-token" style={{ position: "absolute", left: -9999 }}>Admin token</label>
        <input
          id="admin-token" type="password" value={token} placeholder="Admin token"
          onChange={(e) => setToken(e.target.value)}
          style={{ flex: 1, padding: ".5rem", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e5e7eb" }}
        />
        <button type="submit" style={{ padding: ".5rem 1rem", borderRadius: 6, border: "none", background: "#0ea5e9", color: "#001018", fontWeight: 600, cursor: "pointer" }}>
          {loading ? "Loading…" : "Load"}
        </button>
      </form>

      {error && <div role="alert" style={{ border: "1px solid #ef4444", background: "#1f1113", color: "#fca5a5", padding: ".6rem 1rem", borderRadius: 8 }}>{error}</div>}

      {data && (
        <div style={{ display: "grid", gap: "1.25rem", marginTop: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: ".75rem" }}>
            <Tile label="Sessions" value={String(data.totals.sessions)} />
            <Tile label="Assessments" value={String(data.totals.assessments)} />
            <Tile label="Red-flag rate" value={`${(data.safety.red_flag_rate * 100).toFixed(0)}%`} />
            <Tile label="Fallback rate" value={`${(data.safety.fallback_rate * 100).toFixed(0)}%`} />
            <Tile label="Avg confidence" value={data.safety.avg_confidence != null ? `${(data.safety.avg_confidence * 100).toFixed(0)}%` : "—"} />
            <Tile label="Model" value={data.model.ready ? (data.model.model_version ?? "ready") : "rules-only"} />
          </div>

          <section>
            <h2 style={{ fontSize: "1rem" }}>Urgency distribution</h2>
            <Bars data={data.urgency_distribution} colorFor={urgencyColor} />
          </section>

          <section>
            <h2 style={{ fontSize: "1rem" }}>Decision path distribution</h2>
            <Bars data={data.decision_path_distribution} />
          </section>

          <p style={{ color: "#94a3b8", fontSize: ".8rem" }}>
            Engine {data.engine_version}. Urgency legend: {Object.keys(data.urgency_distribution).map(urgencyLabel).join(", ")}.
          </p>
        </div>
      )}
    </main>
  );
}
