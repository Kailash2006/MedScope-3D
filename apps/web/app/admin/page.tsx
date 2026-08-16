"use client";

import { useCallback, useEffect, useState } from "react";
import { adminDashboard } from "../../lib/api";
import { DECISION_PATH_LABEL, urgencyColor, urgencyLabel } from "../../lib/urgency";
import { BarList, Donut, Gauge, Heartbeat, StatTile } from "../../components/admin/charts";
import { AuthNav } from "../../components/AuthNav";

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

const PATH_COLOR: Record<string, string> = {
  VITALS_RED_FLAG: "var(--u-emergency)",
  SYMPTOM_RED_FLAG: "var(--u-urgent)",
  ML: "var(--accent-2)",
  FALLBACK_LOW_CONF: "var(--u-doctor)",
  FALLBACK_MISSING: "var(--u-none)",
  FALLBACK_MODEL_ERROR: "var(--muted-2)",
};

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
    setLoading(true);
    adminDashboard()
      .then((d) => setData(d as unknown as Dashboard))
      .catch(() => {
        const saved = localStorage.getItem(TOKEN_KEY);
        if (saved) { setToken(saved); load(saved); } else { setLoading(false); }
      })
      .finally(() => { if (localStorage.getItem(TOKEN_KEY) === null) setLoading(false); });
  }, [load]);

  const urgencyData = data
    ? Object.entries(data.urgency_distribution).map(([k, v]) => ({ label: urgencyLabel(k), value: v, color: urgencyColor(k) }))
        .sort((a, b) => b.value - a.value)
    : [];
  const pathData = data
    ? Object.entries(data.decision_path_distribution).map(([k, v]) => ({ label: DECISION_PATH_LABEL[k] ?? k, value: v, color: PATH_COLOR[k] ?? "var(--accent-3)" }))
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <main id="main" className="shell" style={{ position: "relative", zIndex: 1 }}>
      <header className="rise rise-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", fontSize: ".7rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent)", marginBottom: ".5rem" }}>
            <span className="live-dot" style={{ background: "var(--u-routine)" }} /> Live · Admin
          </div>
          <h1 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", margin: 0 }}>
            <span className="gradient-text">Safety Dashboard</span>
          </h1>
          <p style={{ color: "var(--muted)", margin: ".35rem 0 0" }}>Aggregate triage safety metrics across all sessions.</p>
        </div>
        <div style={{ display: "inline-flex", gap: ".6rem", alignItems: "center" }}>
          <button type="button" className="chip" onClick={() => load(token || undefined)} disabled={loading}>
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <AuthNav />
        </div>
      </header>

      {!data && (
        <div className="glass rise rise-2" style={{ padding: "1.5rem", maxWidth: 460 }}>
          <p className="card-title">Restricted</p>
          <p style={{ color: "var(--muted)", marginTop: 0, fontSize: ".9rem" }}>
            Log in with an admin account to view this dashboard automatically, or enter the shared admin token.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); load(token); }} style={{ display: "flex", gap: ".5rem", marginTop: ".8rem" }}>
            <label htmlFor="admin-token" className="sr-only">Admin token</label>
            <input id="admin-token" type="password" className="input" value={token} placeholder="Admin token (optional)" onChange={(e) => setToken(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary">{loading ? "…" : "Load"}</button>
          </form>
          {error && <div role="alert" style={{ marginTop: ".8rem", color: "#ffb4bb", fontSize: ".85rem" }}>{error}</div>}
          <p style={{ marginTop: "1rem", fontSize: ".8rem", color: "var(--muted-2)" }}>
            Not an admin? <a href="/login" style={{ color: "var(--accent-2)" }}>Log in</a> or <a href="/triage" style={{ color: "var(--accent-2)" }}>go to triage</a>.
          </p>
        </div>
      )}

      {data && (
        <div className="dash-grid">
          {/* System vitals strip */}
          <section className="glass rise rise-2" style={{ padding: "1.1rem 1.25rem", display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "1.25rem" }}>
            <div>
              <div className="stat-label">System</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: ".2rem", display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
                <span className="live-dot" style={{ background: data.model.ready ? "var(--u-routine)" : "var(--u-doctor)" }} />
                {data.model.ready ? "Operational" : "Rules-only"}
              </div>
            </div>
            <Heartbeat color={data.model.ready ? "var(--u-routine)" : "var(--u-doctor)"} />
            <div style={{ textAlign: "right", display: "grid", gap: ".3rem" }}>
              <span className="chip" style={{ cursor: "default" }}>Model: {data.model.ready ? (data.model.model_version ?? "ready") : "none"}</span>
              <span style={{ fontSize: ".72rem", color: "var(--muted-2)" }}>Engine {data.engine_version}</span>
            </div>
          </section>

          {/* KPI tiles */}
          <section className="dash-grid rise rise-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <StatTile label="Sessions" value={String(data.totals.sessions)} accent="var(--accent-2)" icon="◍" />
            <StatTile label="Assessments" value={String(data.totals.assessments)} accent="var(--accent-3)" icon="≣" />
            <StatTile label="Red-flag rate" value={`${(data.safety.red_flag_rate * 100).toFixed(0)}%`} sub={`${data.safety.red_flag_count} flagged`} accent="var(--u-emergency)" icon="⚑" />
            <StatTile label="Fallback rate" value={`${(data.safety.fallback_rate * 100).toFixed(0)}%`} sub={`${data.safety.fallback_count} fell back`} accent="var(--u-doctor)" icon="↩" />
            <StatTile label="Emergencies" value={String(data.urgency_distribution.EMERGENCY ?? 0)} accent="var(--u-emergency)" icon="✚" />
            <StatTile label="Avg confidence" value={data.safety.avg_confidence != null ? `${(data.safety.avg_confidence * 100).toFixed(0)}%` : "—"} accent="var(--u-routine)" icon="◑" />
          </section>

          {/* Charts row */}
          <section className="dash-grid rise rise-4" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
            <div className="glass" style={{ padding: "1.25rem" }}>
              <p className="card-title">Urgency distribution</p>
              <Donut data={urgencyData} centerLabel="Total" centerValue={String(data.totals.assessments)} />
            </div>
            <div className="glass" style={{ padding: "1.25rem", display: "grid", placeItems: "center", gap: ".6rem" }}>
              <p className="card-title" style={{ justifySelf: "start", width: "100%" }}>Mean confidence</p>
              <Gauge value={data.safety.avg_confidence ?? 0} label="across assessments" color="var(--accent)" />
            </div>
          </section>

          {/* Decision paths */}
          <section className="glass rise rise-5" style={{ padding: "1.25rem" }}>
            <p className="card-title">Decision-path distribution</p>
            <p style={{ color: "var(--muted-2)", fontSize: ".78rem", margin: "0 0 .9rem" }}>
              How each assessment was decided — red-flag rules escalate before the ML model; low confidence and errors route to a conservative fallback.
            </p>
            <BarList data={pathData} />
          </section>

          <p style={{ color: "var(--muted-2)", fontSize: ".72rem", textAlign: "center", marginTop: ".5rem" }}>
            Research/education prototype. Not a diagnosis. Metrics reflect sessions within the current retention window.
          </p>
        </div>
      )}
    </main>
  );
}
