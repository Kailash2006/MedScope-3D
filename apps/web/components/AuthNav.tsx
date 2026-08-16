"use client";

import { useEffect, useState } from "react";
import { fetchMe, logout, type AuthUser } from "../lib/auth";

export function AuthNav() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => { setUser(u); setReady(true); });
  }, []);

  if (!ready) return <span style={{ width: 120 }} aria-hidden />;

  if (!user) {
    return (
      <div style={{ display: "inline-flex", gap: ".5rem", alignItems: "center" }}>
        <a href="/login" className="chip" style={{ textDecoration: "none" }}>Log in</a>
        <a href="/register" className="btn btn-primary" style={{ textDecoration: "none", padding: ".45rem .9rem", fontSize: ".85rem" }}>Sign up</a>
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", gap: ".6rem", alignItems: "center" }}>
      {user.role === "admin" && (
        <a href="/admin" className="chip" style={{ textDecoration: "none" }}>Admin</a>
      )}
      <span title={user.email} style={{ fontSize: ".82rem", color: "var(--muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {user.email}
      </span>
      <button type="button" className="chip"
        onClick={() => { logout(); window.location.href = "/"; }}>
        Log out
      </button>
    </div>
  );
}
