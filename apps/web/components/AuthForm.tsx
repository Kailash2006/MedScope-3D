"use client";

import { useState, type FormEvent } from "react";
import { login, register } from "../lib/auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = isRegister ? await register(email, password) : await login(email, password);
      // Return to the page they came from (?next=), else admins -> dashboard, users -> triage.
      const next = new URLSearchParams(window.location.search).get("next");
      const dest = next && next.startsWith("/") ? next : user.role === "admin" ? "/admin" : "/triage";
      window.location.href = dest;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main id="main" style={{ minHeight: "100vh", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      {/* branded background */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, background: "radial-gradient(760px 520px at 16% 22%, rgba(47,107,255,0.16), transparent 55%), radial-gradient(820px 620px at 84% 82%, rgba(47,107,255,0.10), transparent 55%), var(--bg)" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)", WebkitMaskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)" }} />

      {/* brand name — top-left corner */}
      <a href="/" className="topnav-logo" style={{ position: "absolute", top: "1.5rem", left: "1.75rem", zIndex: 2 }}>
        <span className="topnav-mark" aria-hidden>✳</span> MedScope
      </a>

      <div className="glass rise" style={{ padding: "2rem", width: "min(420px, 92vw)", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", fontSize: ".7rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent)", marginBottom: ".6rem" }}>
          <span className="live-dot" style={{ background: "var(--accent)" }} /> MedScope 3D
        </div>
        <h1 style={{ fontSize: "1.6rem", margin: "0 0 .3rem" }}>
          <span className="gradient-text">{isRegister ? "Create your account" : "Welcome back"}</span>
        </h1>
        <p style={{ color: "var(--muted)", margin: "0 0 1.25rem", fontSize: ".9rem" }}>
          {isRegister ? "Register to save your triage history." : "Log in to your MedScope account."}
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: ".8rem" }}>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" className="input" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input id="password" className="input" type="password" required minLength={8} maxLength={72}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>

          {error && (
            <div role="alert" className="glass-inset" style={{ padding: ".55rem .8rem", color: "#ffb4bb", borderColor: "rgba(251,90,104,0.5)", fontSize: ".85rem" }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ padding: ".7rem", fontSize: "1rem", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Please wait…" : isRegister ? "Create account" : "Log in"}
          </button>
        </form>

        <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: "1.1rem", textAlign: "center" }}>
          {isRegister ? (
            <>Already have an account? <a href="/login" style={{ color: "var(--accent-2)" }}>Log in</a></>
          ) : (
            <>New here? <a href="/register" style={{ color: "var(--accent-2)" }}>Create an account</a></>
          )}
        </p>
        <p style={{ color: "var(--muted-2)", fontSize: ".72rem", marginTop: ".8rem", textAlign: "center" }}>
          Research/education prototype. Do not use real, identifiable health info.
        </p>
      </div>
    </main>
  );
}
