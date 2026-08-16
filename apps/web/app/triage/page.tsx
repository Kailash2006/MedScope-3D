"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { BodyMapper } from "../../components/BodyMapper";
import { DataRightsPanel } from "../../components/DataRightsPanel";
import { HistoryPanel } from "../../components/HistoryPanel";
import { IntakeConsole } from "../../components/IntakeConsole";
import { NLSymptomInput } from "../../components/NLSymptomInput";
import { RedFlagQuestions } from "../../components/RedFlagQuestions";
import { RiskPanel } from "../../components/RiskPanel";
import { SessionSummary } from "../../components/SessionSummary";
import { TopNav } from "../../components/TopNav";
import { AuthGuard } from "../../components/AuthGuard";
import { createSession, sessionWsUrl } from "../../lib/api";
import { reducer, toPatch } from "../../lib/triageState";
import { emptyState, type Assessment } from "../../lib/types";
import { TriageSocket, type SocketStatus } from "../../lib/ws";

export default function TriagePage() {
  return (
    <AuthGuard>
      <TriageConsole />
    </AuthGuard>
  );
}

function TriageConsole() {
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
      <TopNav active="triage" />
      <div className="rise rise-1" style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", margin: 0 }}>
          <span className="gradient-text">Symptom Triage</span>
        </h1>
        <p style={{ color: "var(--muted)", margin: ".3rem 0 0", maxWidth: 620, fontSize: ".95rem" }}>
          Describe or select symptoms on the 3D model and get live urgency guidance — never a diagnosis.
        </p>
      </div>

      {error && (
        <div role="alert" className="glass rise" style={{ borderColor: "rgba(251,90,104,0.5)", color: "#ffb4bb", padding: ".8rem 1.1rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="triage-grid">
        {/* Left: live session summary + data entry */}
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="rise rise-1"><SessionSummary state={state} /></div>
          <div className="rise rise-2"><NLSymptomInput dispatch={dispatch} /></div>
          <RedFlagQuestions state={state} dispatch={dispatch} />
          <div className="rise rise-3"><IntakeConsole state={state} dispatch={dispatch} /></div>
        </div>

        {/* Center: the 3D body — the sole centrepiece */}
        <div className="rise rise-2"><BodyMapper selected={state.regions} onToggle={(code) => dispatch({ type: "toggleRegion", code })} urgency={assessment?.urgency} /></div>

        {/* Right: urgency guidance + records */}
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
          <RiskPanel assessment={assessment} status={status} saved={saved} state={state} />
          <HistoryPanel sessionId={sessionId} refreshKey={refreshKey} />
          <div>
            <DataRightsPanel
              sessionId={sessionId}
              onDeleted={() => { dispatch({ type: "reset" }); setSessionId(null); setSessionNonce((n) => n + 1); }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
