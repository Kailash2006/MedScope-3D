"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { RegionCode } from "../../lib/regions";
import { BodyModel } from "./BodyModel";

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

// Client-only Canvas host. Imported via next/dynamic (ssr:false) so three.js
// never runs during SSR. Decorative: keyboard selection is in RegionSelector.
export default function BodyCanvas({ selected, onToggle, urgency }: Props) {
  return (
    <div
      aria-hidden="true"
      style={{ width: "100%", height: 360, borderRadius: 12, overflow: "hidden", background: "#0b1120" }}
    >
      <Canvas camera={{ position: [0, 1, 8], fov: 45 }} dpr={[1, 1.5]}>
        <BodyModel selected={selected} onToggle={onToggle} urgency={urgency} />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={12} />
      </Canvas>
    </div>
  );
}
