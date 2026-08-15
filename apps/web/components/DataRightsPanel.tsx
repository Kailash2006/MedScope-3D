"use client";

import { useState } from "react";
import { deleteSession, exportSession, setRetention } from "../lib/api";

interface Props {
  sessionId: string | null;
  onDeleted: () => void;
}

const btn = {
  padding: ".4rem .7rem", borderRadius: 6, border: "1px solid #334155",
  background: "#0f172a", color: "#cbd5e1", cursor: "pointer", fontSize: ".82rem",
};

const RETENTIONS = [7, 30, 90];

export function DataRightsPanel({ sessionId, onDeleted }: Props) {
  const [note, setNote] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doExport() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const data = await exportSession(sessionId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medscope-${sessionId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote("Exported your data as JSON.");
    } finally {
      setBusy(false);
    }
  }

  async function doRetention(days: number) {
    if (!sessionId) return;
    await setRetention(sessionId, days);
    setNote(`Retention set to ${days} days.`);
  }

  async function doDelete() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await deleteSession(sessionId);
      setConfirming(false);
      setNote("Your data was deleted. A fresh session has started.");
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="data-heading" className="glass" style={{ padding: "1.1rem" }}>
      <h2 id="data-heading" style={{ fontSize: "1.05rem", margin: "0 0 .5rem" }}>Your data &amp; privacy</h2>
      <p style={{ color: "#94a3b8", fontSize: ".82rem", margin: "0 0 .75rem", lineHeight: 1.5 }}>
        Anonymous, session-scoped data. Export or delete it any time. Do not enter real,
        identifiable health information. Research/education prototype — not HIPAA-compliant.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", marginBottom: ".6rem" }}>
        <span style={{ fontSize: ".8rem", color: "#94a3b8" }}>Retention:</span>
        {RETENTIONS.map((d) => (
          <button key={d} type="button" style={btn} onClick={() => doRetention(d)} disabled={!sessionId}>
            {d} days
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button type="button" style={btn} onClick={doExport} disabled={!sessionId || busy}>
          ⬇ Export my data (JSON)
        </button>
        {!confirming ? (
          <button
            type="button"
            style={{ ...btn, borderColor: "#7f1d1d", color: "#fca5a5" }}
            onClick={() => setConfirming(true)}
            disabled={!sessionId || busy}
          >
            Delete my data
          </button>
        ) : (
          <>
            <button type="button" style={{ ...btn, background: "#ef4444", color: "#fff", border: "none" }} onClick={doDelete} disabled={busy}>
              Confirm delete
            </button>
            <button type="button" style={btn} onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
          </>
        )}
      </div>

      {note && <p role="status" style={{ color: "#38bdf8", fontSize: ".8rem", marginTop: ".6rem" }}>{note}</p>}
    </section>
  );
}
