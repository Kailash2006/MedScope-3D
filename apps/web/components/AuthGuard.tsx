"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchMe } from "../lib/auth";

// Gate a page behind login. Unauthenticated visitors are redirected to /login
// with a ?next= return path. Children (and their hooks) only mount once auth is
// confirmed, so protected data never loads for logged-out users.
export function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok">("loading");

  useEffect(() => {
    let active = true;
    fetchMe().then((user) => {
      if (!active) return;
      if (user) {
        setStatus("ok");
      } else {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?next=${next}`);
      }
    });
    return () => { active = false; };
  }, []);

  if (status === "ok") return <>{children}</>;

  return (
    <main className="shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ display: "grid", gap: ".8rem", justifyItems: "center", color: "var(--muted)" }}>
        <span className="live-dot" style={{ background: "var(--accent)", width: 12, height: 12 }} />
        <span style={{ fontSize: ".9rem" }}>Checking your session…</span>
      </div>
    </main>
  );
}
