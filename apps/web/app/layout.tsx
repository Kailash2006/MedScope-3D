import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "MedScope 3D — Symptom Triage (Prototype)",
  description:
    "Research/education prototype for 3D symptom triage. Not a diagnosis. Not medical advice.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b1120",
          color: "#e5e7eb",
        }}
      >
        <a
          href="#main"
          style={{
            position: "absolute",
            left: -9999,
            top: 0,
          }}
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
