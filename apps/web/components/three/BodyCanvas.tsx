"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, OrbitControls } from "@react-three/drei";
import type { RegionCode } from "../../lib/regions";
import { urgencyColor } from "../../lib/urgency";
import { BodyModel } from "./BodyModel";

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

// Client-only Canvas host. Imported via next/dynamic (ssr:false). Decorative:
// keyboard selection lives in RegionSelector alongside.
export default function BodyCanvas({ selected, onToggle, urgency }: Props) {
  const accent = urgency ? urgencyColor(urgency) : "#22d3ee";
  return (
    <div aria-hidden="true" style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden" }}>
      <Canvas
        camera={{ position: [0, 0.6, 9], fov: 42 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.35} />
        <spotLight position={[6, 8, 6]} angle={0.5} penumbra={1} intensity={1.1} color="#bfe9ff" />
        <pointLight position={[-6, 2, -4]} intensity={0.5} color={accent} />

        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.5}>
          <BodyModel selected={selected} onToggle={onToggle} urgency={urgency} />
        </Float>

        <ContactShadows position={[0, -3.4, 0]} opacity={0.55} scale={12} blur={2.6} far={5} color="#000000" />

        {/* self-contained studio environment (no external HDRI) */}
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 4, -6]} scale={[10, 6, 1]} color="#8fd4ff" />
          <Lightformer intensity={1.4} position={[-5, 1, 2]} scale={[4, 8, 1]} color="#7c8cff" />
          <Lightformer intensity={1.4} position={[5, 1, 2]} scale={[4, 8, 1]} color="#4fe4ff" />
        </Environment>

        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.7}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}
