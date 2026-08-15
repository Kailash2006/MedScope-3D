import { URGENCY_LEVELS, labelOf, DISCLAIMER, type UrgencyLevel } from "@medscope/triage-shared";

const COLORS: Record<string, string> = {
  EMERGENCY: "#ef4444",
  URGENT_TODAY: "#f97316",
  DOCTOR_SOON: "#eab308",
  ROUTINE: "#22c55e",
  SELF_CARE: "#38bdf8",
  INSUFFICIENT_INFO: "#94a3b8",
};

export default function Home() {
  return (
    <main id="main" style={{ maxWidth: 820, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: ".25rem" }}>MedScope 3D</h1>
      <p style={{ color: "#94a3b8", marginTop: 0 }}>
        Real-time 3D ML symptom triage — <strong>urgency guidance only</strong>.
      </p>

      <section
        role="note"
        style={{
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          background: "#111827",
          margin: "1.5rem 0",
        }}
      >
        <strong>⚠️ Disclaimer</strong>
        <p style={{ margin: ".5rem 0 0", lineHeight: 1.5 }}>{DISCLAIMER}</p>
      </section>

      <h2 style={{ fontSize: "1.1rem" }}>Urgency levels</h2>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: ".5rem" }}>
        {(URGENCY_LEVELS as UrgencyLevel[]).map((level) => (
          <li
            key={level}
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".75rem",
              padding: ".5rem .75rem",
              borderRadius: 8,
              background: "#0f172a",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: COLORS[level] ?? "#94a3b8",
                flexShrink: 0,
              }}
            />
            <span>{labelOf(level)}</span>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: "2rem" }}>
        <a
          href="/triage"
          style={{
            display: "inline-block",
            padding: ".7rem 1.2rem",
            borderRadius: 8,
            background: "#0ea5e9",
            color: "#001018",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Start a triage session →
        </a>
      </p>
    </main>
  );
}
