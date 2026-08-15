import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "MedScope 3D — Symptom Triage (Prototype)",
  description:
    "Research/education prototype for 3D symptom triage. Not a diagnosis. Not medical advice.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
