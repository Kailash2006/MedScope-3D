"use client";

import { REGIONS, type RegionCode } from "../lib/regions";

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
}

// The canonical, keyboard-accessible way to select body regions. The 3D / SVG
// views are visual mirrors of this same state, so keyboard users lose nothing.
export function RegionSelector({ selected, onToggle }: Props) {
  return (
    <div role="group" aria-label="Body regions">
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
        {REGIONS.map((r) => {
          const on = selected.includes(r.code);
          return (
            <li key={r.code}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(r.code)}
                style={{
                  cursor: "pointer",
                  padding: ".4rem .7rem",
                  borderRadius: 999,
                  border: `1px solid ${on ? "#38bdf8" : "#334155"}`,
                  background: on ? "#0ea5e9" : "#0f172a",
                  color: on ? "#001018" : "#cbd5e1",
                  fontSize: ".85rem",
                }}
              >
                {r.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
