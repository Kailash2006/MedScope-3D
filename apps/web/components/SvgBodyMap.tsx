"use client";

import { REGIONS, type RegionCode } from "../lib/regions";
import { urgencyColor } from "../lib/urgency";

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

// Lightweight 2D body map — the low-power / no-WebGL fallback. Rects are clickable
// for mouse users; keyboard selection lives in RegionSelector (rendered alongside).
export function SvgBodyMap({ selected, onToggle, urgency }: Props) {
  const accent = urgency ? urgencyColor(urgency) : "#38bdf8";
  return (
    <svg
      viewBox="0 0 100 200"
      role="img"
      aria-label="Body map (2D). Use the region buttons to select areas."
      style={{ width: "100%", maxWidth: 260, height: "auto", background: "#0b1120", borderRadius: 12 }}
    >
      {REGIONS.map((r) => {
        const on = selected.includes(r.code);
        return (
          <rect
            key={r.code}
            x={r.svg.x}
            y={r.svg.y}
            width={r.svg.w}
            height={r.svg.h}
            rx={3}
            onClick={() => onToggle(r.code)}
            aria-hidden="true"
            style={{
              cursor: "pointer",
              fill: on ? accent : "#1e293b",
              stroke: on ? "#e2e8f0" : "#334155",
              strokeWidth: 0.8,
              transition: "fill .15s",
            }}
          >
            <title>{r.label}</title>
          </rect>
        );
      })}
    </svg>
  );
}
