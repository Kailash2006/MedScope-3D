"use client";

import { useState } from "react";
import { REGIONS, type RegionCode } from "../../lib/regions";
import { urgencyColor } from "../../lib/urgency";

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

// Procedural body: one rounded box per region, grouped in a front-facing layout.
// No external assets — fully self-contained (CSP-safe).
export function BodyModel({ selected, onToggle, urgency }: Props) {
  const [hovered, setHovered] = useState<RegionCode | null>(null);
  const accent = urgency ? urgencyColor(urgency) : "#38bdf8";

  return (
    <group>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 6]} intensity={1.1} />
      {REGIONS.map((r) => {
        const on = selected.includes(r.code);
        const isHover = hovered === r.code;
        return (
          <mesh
            key={r.code}
            position={r.box.pos}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(r.code);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(r.code);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHovered(null);
              document.body.style.cursor = "auto";
            }}
          >
            <boxGeometry args={r.box.size} />
            <meshStandardMaterial
              color={on ? accent : isHover ? "#475569" : "#334155"}
              emissive={on ? accent : "#000000"}
              emissiveIntensity={on ? 0.35 : 0}
              roughness={0.6}
              metalness={0.1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
