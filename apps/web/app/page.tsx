"use client";

import dynamic from "next/dynamic";
import { URGENCY_LEVELS, labelOf, type UrgencyLevel } from "@medscope/triage-shared";
import { urgencyColor } from "../lib/urgency";
import { AuthNav } from "../components/AuthNav";

const MedicalHero = dynamic(() => import("../components/three/MedicalHero"), {
  ssr: false,
  loading: () => <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)" }}>Loading 3D…</div>,
});

export default function Home() {
  return (
    <main id="main" className="shell" style={{ minHeight: "100vh", display: "grid", alignItems: "center" }}>
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "flex-end", padding: "1.25rem 1.5rem", zIndex: 2 }}>
        <AuthNav />
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "2rem", alignItems: "center" }} className="hero-grid">
        <div className="rise rise-1">
          <div style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", fontSize: ".72rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "1rem" }}>
            <span className="live-dot" style={{ background: "var(--accent)" }} /> Research / education prototype
          </div>
          <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)", margin: 0, lineHeight: 1.02 }}>
            <span className="gradient-text">MedScope 3D</span>
          </h1>
          <p style={{ fontSize: "clamp(1rem, 2.2vw, 1.35rem)", color: "var(--text)", margin: "1rem 0 .5rem", maxWidth: 520 }}>
            Real-time 3D symptom triage. Point at the body, describe the symptoms, get <strong>urgency guidance</strong> — instantly.
          </p>
          <p style={{ color: "var(--muted)", maxWidth: 500 }}>
            Rules-first safety engine + a model trained on real ED data. Never a diagnosis, never medication advice.
          </p>

          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", margin: "1.75rem 0" }}>
            <a href="/triage" className="btn btn-primary" style={{ textDecoration: "none", padding: ".8rem 1.4rem", fontSize: "1rem" }}>
              Start a triage session →
            </a>
            <a href="/admin" className="btn" style={{ textDecoration: "none", padding: ".8rem 1.4rem" }}>Admin dashboard</a>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
            {(URGENCY_LEVELS as UrgencyLevel[]).map((lvl) => (
              <li key={lvl} className="glass-inset" style={{ display: "inline-flex", alignItems: "center", gap: ".45rem", padding: ".35rem .7rem", fontSize: ".8rem" }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: urgencyColor(lvl), boxShadow: `0 0 10px ${urgencyColor(lvl)}` }} />
                {labelOf(lvl)}
              </li>
            ))}
          </ul>
        </div>

        <div className="rise rise-3" style={{ height: 560, overflow: "hidden", position: "relative", borderRadius: "var(--radius)", background: "radial-gradient(120% 90% at 62% 42%, rgba(90,208,255,0.10), transparent 58%), radial-gradient(80% 60% at 30% 80%, rgba(139,92,246,0.10), transparent 60%), #04070f", boxShadow: "inset 0 0 0 1px var(--border), var(--shadow)" }}>
          <MedicalHero />
          <p style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", color: "var(--muted-2)", fontSize: ".72rem", letterSpacing: ".14em", textTransform: "uppercase", margin: 0, pointerEvents: "none" }}>
            Live body scan · heartbeat · genomic signals
          </p>
        </div>
      </div>

      <p style={{ color: "var(--muted-2)", fontSize: ".72rem", marginTop: "2.5rem", textAlign: "center" }}>
        Not HIPAA-compliant. Do not enter real, identifiable health information.
      </p>
    </main>
  );
}
