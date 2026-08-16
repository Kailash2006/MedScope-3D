"use client";

import { useState } from "react";
import { extractSymptoms, type ExtractResult } from "../lib/api";
import { humanize } from "../lib/vocab";
import { useSpeech } from "../lib/speech";
import type { Action } from "../lib/triageState";

const EXAMPLES = [
  "Crushing chest pain spreading to my left arm, I'm a smoker with high blood pressure",
  "Bad headache and a stiff neck since this morning, feeling feverish",
  "Throwing up and my belly hurts for 2 days, no fever",
];

export function NLSymptomInput({ dispatch }: { dispatch: (a: Action) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Voice input (browser Web Speech API — on-device, no keys). Transcribes into
  // the box live and analyzes automatically when you stop speaking.
  const speech = useSpeech(
    (transcript) => setText(transcript),
    (finalText) => { if (finalText.trim()) analyze(finalText); },
  );

  async function analyze(input?: string) {
    const q = (input ?? text).trim();
    if (!q) return;
    if (input) setText(input);
    setBusy(true);
    setError(null);
    try {
      const r = await extractSymptoms(q);
      setResult(r);
      dispatch({ type: "applyExtracted", data: { symptoms: r.symptoms, regions: r.regions, risk_factors: r.risk_factors, vitals: r.vitals } });
    } catch {
      setError("Could not analyze — please add symptoms manually below.");
    } finally {
      setBusy(false);
    }
  }

  const chips: { label: string; tint: string }[] = result
    ? [
        ...result.symptoms.map((s) => ({ label: `${humanize(s.code)} · ${s.severity}/10`, tint: "var(--accent-2)" })),
        ...result.regions.map((r) => ({ label: humanize(r), tint: "var(--accent-3)" })),
        ...result.risk_factors.map((r) => ({ label: humanize(r), tint: "var(--u-doctor)" })),
        ...Object.entries(result.vitals).map(([k, v]) => ({ label: `${k.toUpperCase()} ${v}`, tint: "var(--u-routine)" })),
      ]
    : [];

  return (
    <div className="glass" style={{ padding: "1.1rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 100% 0%, rgba(56,189,248,0.10), transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".5rem" }}>
          <span aria-hidden style={{ fontSize: "1rem" }}>✨</span>
          <p className="card-title" style={{ margin: 0 }}>Describe it in your own words</p>
        </div>
        <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "0 0 .7rem" }}>
          Type how you feel in plain English — MedScope reads it and fills in the form below.
        </p>

        <textarea
          className="input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") analyze(); }}
          placeholder="e.g. sharp chest pain and short of breath for an hour…"
          style={{ resize: "vertical", minHeight: 56 }}
          aria-label="Describe your symptoms in plain English"
        />

        <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginTop: ".6rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={() => analyze()} disabled={busy || !text.trim()}>
            {busy ? "Reading…" : "✨ Analyze"}
          </button>
          {speech.supported && (
            <button
              type="button"
              className="btn"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              aria-label={speech.listening ? "Stop voice input" : "Speak your symptoms"}
              style={speech.listening
                ? { borderColor: "rgba(251,90,104,0.6)", color: "#ffb4bb", display: "inline-flex", alignItems: "center", gap: ".4rem" }
                : { display: "inline-flex", alignItems: "center", gap: ".4rem" }}
            >
              {speech.listening ? (
                <><span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--u-emergency)", boxShadow: "0 0 10px var(--u-emergency)", animation: "haloPulse 1.2s ease-in-out infinite" }} /> Listening…</>
              ) : (
                <>🎤 Speak</>
              )}
            </button>
          )}
          <span style={{ fontSize: ".72rem", color: "var(--muted-2)" }}>Runs privately — no third-party AI.</span>
        </div>

        {!result && !text && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".7rem" }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" style={{ fontSize: ".74rem" }} onClick={() => analyze(ex)}>
                {ex.length > 42 ? ex.slice(0, 42) + "…" : ex}
              </button>
            ))}
          </div>
        )}

        {error && <p role="alert" style={{ color: "#ffb4bb", fontSize: ".82rem", marginTop: ".6rem" }}>{error}</p>}

        {result && (
          <div className="pop" style={{ marginTop: ".8rem" }}>
            {chips.length ? (
              <>
                <p style={{ fontSize: ".76rem", color: "var(--muted)", margin: "0 0 .4rem" }}>Added to your triage — review or edit below:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
                  {chips.map((c, i) => (
                    <span key={i} className="glass-inset" style={{ padding: ".3rem .6rem", fontSize: ".76rem", display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
                      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: c.tint }} />
                      {c.label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: ".8rem", color: "var(--muted)", margin: 0 }}>
                Nothing matched confidently — add symptoms manually below, or rephrase.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
