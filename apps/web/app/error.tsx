"use client";

// Route-level error boundary (Next.js App Router). Catches render errors in the
// triage/admin pages and shows a recoverable message instead of a blank screen.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1.25rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.4rem" }}>Something went wrong</h1>
      <p style={{ color: "#94a3b8" }}>
        The page hit an unexpected error. Your data is safe — try again.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{ marginTop: "1rem", padding: ".6rem 1.2rem", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#001018", fontWeight: 600, cursor: "pointer" }}
      >
        Try again
      </button>
      <p style={{ color: "#94a3b8", fontSize: ".8rem", marginTop: "2rem" }}>
        Research/education prototype. Not a diagnosis. Not medical advice.
      </p>
    </main>
  );
}
