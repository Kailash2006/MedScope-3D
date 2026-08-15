"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  AdaptiveDpr, ContactShadows, Float, OrbitControls, Sparkles,
} from "@react-three/drei";
import { AdditiveBlending, BackSide, type Group, type Mesh } from "three";
import type { RegionCode } from "../../lib/regions";
import { urgencyColor } from "../../lib/urgency";
import { BodyModel } from "./BodyModel";

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

// Rotating "energy field" rings behind the body.
function AuraRings({ color }: { color: string }) {
  const g = useRef<Group>(null);
  useFrame((s, dt) => {
    if (!g.current) return;
    g.current.rotation.z += dt * 0.25;
    g.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.3) * 0.15;
  });
  return (
    <group ref={g} position={[0, 0.2, -1.2]}>
      {[2.9, 3.5, 4.2].map((r, i) => (
        <mesh key={r} rotation={[Math.PI / 2, 0, i * 0.6]}>
          <torusGeometry args={[r, 0.012, 8, 128]} />
          <meshBasicMaterial color={color} transparent opacity={0.55 - i * 0.13} blending={AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

// Soft glowing backlight that pulses in the urgency colour (cheap fake-bloom).
function Backlight({ color, boost }: { color: string; boost: boolean }) {
  const m = useRef<Mesh>(null);
  useFrame((s) => {
    if (!m.current) return;
    const base = boost ? 0.28 : 0.16;
    const mat = m.current.material as { opacity: number };
    mat.opacity = base + Math.sin(s.clock.elapsedTime * 1.6) * 0.05;
  });
  return (
    <mesh ref={m} position={[0, 0.2, -2.4]} scale={boost ? 9 : 7.5}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.18} blending={AdditiveBlending} side={BackSide} />
    </mesh>
  );
}

export default function BodyCanvas({ selected, onToggle, urgency }: Props) {
  const accent = urgency ? urgencyColor(urgency) : "#22d3ee";
  const emergency = urgency === "EMERGENCY";

  return (
    <div aria-hidden="true" style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden" }}>
      <Canvas
        camera={{ position: [0, 0.6, 9], fov: 42 }}
        dpr={[1, 1.7]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[emergency ? "#12060f" : "#070c18"]} />
        <fog attach="fog" args={[emergency ? "#160611" : "#070c18", 10, 20]} />
        {/* rich direct lighting (no off-screen env render) */}
        <hemisphereLight args={["#bfe9ff", "#0a1120", 0.9]} />
        <ambientLight intensity={0.35} />
        <spotLight position={[6, 8, 6]} angle={0.5} penumbra={1} intensity={2.2} color="#dff2ff" />
        <pointLight position={[-6, 2, -4]} intensity={1.4} color={accent} />
        <pointLight position={[5, -2, 4]} intensity={0.8} color="#7c8cff" />

        <Backlight color={accent} boost={emergency} />
        <AuraRings color={accent} />
        <Sparkles count={60} scale={[9, 11, 6]} size={2.6} speed={0.35} opacity={0.5} color={accent} />

        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.5}>
          <BodyModel selected={selected} onToggle={onToggle} urgency={urgency} />
        </Float>

        <ContactShadows position={[0, -3.4, 0]} opacity={0.55} scale={12} blur={2.6} far={5} color="#000000" />

        <OrbitControls makeDefault enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.7}
          minPolarAngle={Math.PI / 2.6} maxPolarAngle={Math.PI / 1.9} />
        <AdaptiveDpr pixelated />
      </Canvas>
    </div>
  );
}
