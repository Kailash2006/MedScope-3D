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
      viewBox="0 0 100 156"
      role="img"
      aria-label="Body map (2D). Use the region buttons to select areas."
      style={{ width: "100%", maxWidth: 220, height: "auto", display: "block", margin: "0 auto" }}
    >
      <defs>
        <radialGradient id="bodyGlow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* soft aura so the figure reads as a body, not floating boxes */}
      <ellipse cx={50} cy={70} rx={46} ry={78} fill="url(#bodyGlow)" />

      {REGIONS.map((r) => {
        const on = selected.includes(r.code);
        const common = {
          onClick: () => onToggle(r.code),
          "aria-hidden": "true" as const,
          style: {
            cursor: "pointer",
            fill: on ? accent : r.code === "back" ? "#2a3a55" : "#1e293b",
            stroke: on ? "#e2e8f0" : "#334155",
            strokeWidth: 0.8,
            transition: "fill .15s",
          },
        };
        if (r.code === "head") {
          return (
            <ellipse key={r.code} cx={r.svg.x + r.svg.w / 2} cy={r.svg.y + r.svg.h / 2} rx={r.svg.w / 2} ry={r.svg.h / 2} {...common}>
              <title>{r.label}</title>
            </ellipse>
          );
        }
        return (
          <rect key={r.code} x={r.svg.x} y={r.svg.y} width={r.svg.w} height={r.svg.h} rx={r.code === "back" ? 3 : 5} {...common}>
            <title>{r.label}</title>
          </rect>
        );
      })}
    </svg>
  );
}
