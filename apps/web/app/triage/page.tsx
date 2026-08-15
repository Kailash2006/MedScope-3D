"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { BodyMapper } from "../../components/BodyMapper";
import { DataRightsPanel } from "../../components/DataRightsPanel";
import { HistoryPanel } from "../../components/HistoryPanel";
import { IntakeConsole } from "../../components/IntakeConsole";
import { RiskPanel } from "../../components/RiskPanel";
import { createSession, sessionWsUrl } from "../../lib/api";
import { reducer, toPatch } from "../../lib/triageState";
import { emptyState, type Assessment } from "../../lib/types";
import { TriageSocket, type SocketStatus } from "../../lib/ws";

export default function TriagePage() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessionNonce, setSessionNonce] = useState(0);

  const socketRef = useRef<TriageSocket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bootstrap: create a session, then open the live socket. Re-runs when
  // sessionNonce changes (e.g. after the user deletes their data).
  useEffect(() => {
    let socket: TriageSocket | null = null;
    setAssessment(null);
    createSession()
      .then((s) => {
        setSessionId(s.id);
        socket = new TriageSocket(sessionWsUrl(s.id), {
          onStatus: setStatus,
          onAssessment: (a) => { setAssessment(a); setSaved(false); setRefreshKey((k) => k + 1); },
          onSaved: () => setSaved(true),
          onError: (m) => setError(typeof m === "string" ? m : "Update rejected"),
        });
        socketRef.current = socket;
        socket.connect();
      })
      .catch(() => setError("Could not start a session. Is the API running?"));
    return () => socket?.close();
  }, [sessionNonce]);

  // Debounced autosave: push patches as the form changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      socketRef.current?.sendUpdate(toPatch(stateRef.current));
      setSaved(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [state]);

  return (
    <main id="main" className="shell">
      <header className="rise rise-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", fontSize: ".7rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent)", marginBottom: ".5rem" }}>
            <span className="live-dot" style={{ background: "var(--accent)" }} /> MedScope 3D
          </div>
          <h1 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", margin: 0 }}>
            <span className="gradient-text">Interactive 3D Symptom Triage</span>
          </h1>
          <p style={{ color: "var(--muted)", margin: ".35rem 0 0", maxWidth: 560 }}>
            Select body regions on the 3D model, add symptoms and vitals, and get live urgency guidance — never a diagnosis.
          </p>
        </div>
        <a href="/admin" className="chip" style={{ textDecoration: "none" }}>Admin →</a>
      </header>

      {error && (
        <div role="alert" className="glass rise" style={{ borderColor: "rgba(251,90,104,0.5)", color: "#ffb4bb", padding: ".8rem 1.1rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="triage-grid">
        <BodyMapper selected={state.regions} onToggle={(code) => dispatch({ type: "toggleRegion", code })} urgency={assessment?.urgency} />

        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="rise rise-2 reveal-3d"><IntakeConsole state={state} dispatch={dispatch} /></div>
          <div className="reveal-3d"><HistoryPanel sessionId={sessionId} refreshKey={refreshKey} /></div>
          <div className="reveal-3d">
            <DataRightsPanel
              sessionId={sessionId}
              onDeleted={() => { dispatch({ type: "reset" }); setSessionId(null); setSessionNonce((n) => n + 1); }}
            />
          </div>
        </div>

        <RiskPanel assessment={assessment} status={status} saved={saved} />
      </div>
    </main>
  );
}
