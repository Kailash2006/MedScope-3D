"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { BodyMapper } from "../../components/BodyMapper";
import { DataRightsPanel } from "../../components/DataRightsPanel";
import { HistoryPanel } from "../../components/HistoryPanel";
import { Demographics } from "../../components/forms/Demographics";
import { RiskFactors } from "../../components/forms/RiskFactors";
import { SymptomForm } from "../../components/forms/SymptomForm";
import { VitalsForm } from "../../components/forms/VitalsForm";
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
    <main id="main" style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>MedScope 3D — Symptom Triage</h1>
        <p style={{ color: "#94a3b8", margin: ".25rem 0 0" }}>Urgency guidance only. Not a diagnosis.</p>
      </header>

      {error && (
        <div role="alert" style={{ border: "1px solid #ef4444", background: "#1f1113", color: "#fca5a5", padding: ".75rem 1rem", borderRadius: 10, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="triage-grid">
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <BodyMapper selected={state.regions} onToggle={(code) => dispatch({ type: "toggleRegion", code })} urgency={assessment?.urgency} />
          <Demographics state={state} dispatch={dispatch} />
          <SymptomForm state={state} dispatch={dispatch} />
          <VitalsForm state={state} dispatch={dispatch} />
          <RiskFactors state={state} dispatch={dispatch} />
          <HistoryPanel sessionId={sessionId} refreshKey={refreshKey} />
          <DataRightsPanel
            sessionId={sessionId}
            onDeleted={() => { dispatch({ type: "reset" }); setSessionId(null); setSessionNonce((n) => n + 1); }}
          />
        </div>
        <RiskPanel assessment={assessment} status={status} saved={saved} />
      </div>
    </main>
  );
}
