"use client";

import { useRef, useState } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { REGIONS, type RegionCode } from "../../lib/regions";
import { urgencyColor } from "../../lib/urgency";

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

const LIMBS = new Set<RegionCode>(["arm_left", "arm_right", "leg_left", "leg_right"]);

function Region({
  code, pos, size, selected, hovered, accent, onToggle, onHover,
}: {
  code: RegionCode;
  pos: [number, number, number];
  size: [number, number, number];
  selected: boolean;
  hovered: boolean;
  accent: string;
  onToggle: (c: RegionCode) => void;
  onHover: (c: RegionCode | null) => void;
}) {
  const mat = useRef<MeshStandardMaterial>(null);
  const mesh = useRef<Mesh>(null);
  // animate emissive + scale on selection/hover for a "living" feel
  useFrame((state) => {
    if (!mat.current || !mesh.current) return;
    const t = state.clock.elapsedTime;
    const targetE = selected ? 0.7 + Math.sin(t * 3) * 0.25 : hovered ? 0.28 : 0.0;
    mat.current.emissiveIntensity += (targetE - mat.current.emissiveIntensity) * 0.15;
    const s = selected ? 1.06 : hovered ? 1.03 : 1;
    mesh.current.scale.x += (s - mesh.current.scale.x) * 0.15;
    mesh.current.scale.y += (s - mesh.current.scale.y) * 0.15;
    mesh.current.scale.z += (s - mesh.current.scale.z) * 0.15;
  });

  const handlers = {
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onToggle(code); },
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onHover(code); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { onHover(null); document.body.style.cursor = "auto"; },
  };

  const color = selected ? accent : hovered ? "#41506e" : "#2b3654";
  const common = (
    <meshStandardMaterial
      ref={mat}
      color={color}
      emissive={accent}
      emissiveIntensity={0}
      metalness={0.45}
      roughness={0.35}
    />
  );

  if (code === "head") {
    return (
      <mesh ref={mesh} position={pos} {...handlers}>
        <sphereGeometry args={[size[0] * 0.55, 40, 40]} />
        {common}
      </mesh>
    );
  }
  if (LIMBS.has(code)) {
    return (
      <mesh ref={mesh} position={pos} {...handlers}>
        <capsuleGeometry args={[Math.min(size[0], size[2]) * 0.45, size[1] * 0.7, 8, 20]} />
        {common}
      </mesh>
    );
  }
  return (
    <RoundedBox ref={mesh as never} position={pos} args={size} radius={Math.min(...size) * 0.28} smoothness={5} {...handlers}>
      {common}
    </RoundedBox>
  );
}

// Procedural body: rounded torso/head + capsule limbs, region-glow on select.
export function BodyModel({ selected, onToggle, urgency }: Props) {
  const [hovered, setHovered] = useState<RegionCode | null>(null);
  const accent = urgency ? urgencyColor(urgency) : "#22d3ee";

  return (
    <group position={[0, -0.4, 0]}>
      {REGIONS.map((r) => (
        <Region
          key={r.code}
          code={r.code}
          pos={r.box.pos}
          size={r.box.size}
          selected={selected.includes(r.code)}
          hovered={hovered === r.code}
          accent={accent}
          onToggle={onToggle}
          onHover={setHovered}
        />
      ))}
      {/* soft ground ring for grounding */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.05, 0]}>
        <ringGeometry args={[1.1, 1.9, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.12} />
      </mesh>
    </group>
  );
}
