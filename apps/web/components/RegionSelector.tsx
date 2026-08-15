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
        {REGIONS.map((r) => (
          <li key={r.code}>
            <button
              type="button"
              className="chip"
              aria-pressed={selected.includes(r.code)}
              onClick={() => onToggle(r.code)}
            >
              {r.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
