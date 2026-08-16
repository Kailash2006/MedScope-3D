"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { AdditiveBlending, Color, type Group, type Mesh, MathUtils } from "three";

// Large dark "planet" that catches a soft rim light — the body of the orb.
function DarkPlanet() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[2.55, 64, 64]} />
      <meshStandardMaterial color="#070b16" roughness={0.6} metalness={0.4} emissive="#0a1428" emissiveIntensity={0.22} />
    </mesh>
  );
}

// Bright cyan-white core with layered additive halos (fake bloom) sitting
// toward the upper-left front of the planet, like an inner sun.
function GlowCore() {
  const core = useRef<Mesh>(null);
  useFrame((s) => {
    if (core.current) core.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 1.4) * 0.05);
  });
  return (
    <group position={[-0.85, 0.7, 2.75]}>
      {[1.5, 1.0, 0.62, 0.4].map((r, i) => (
        <mesh key={r} position={[0, 0, -i * 0.03]}>
          <circleGeometry args={[r, 64]} />
          <meshBasicMaterial
            color={i === 0 ? new Color("#1e4bd8") : i === 1 ? new Color("#3aa6ff") : new Color("#cff4ff")}
            transparent
            opacity={i === 0 ? 0.12 : i === 1 ? 0.2 : i === 2 ? 0.34 : 0.55}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh ref={core}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color="#e6fbff" />
      </mesh>
    </group>
  );
}

// Tilted concentric orbital rings (solid + faint), amber / violet / cyan.
function Rings() {
  const rings = useMemo(
    () => [
      { r: 3.05, tube: 0.006, color: "#f0b429", opacity: 0.6, rot: [1.15, 0.2, 0.1], seg: 200 },
      { r: 3.55, tube: 0.004, color: "#8b5cf6", opacity: 0.45, rot: [1.35, -0.35, 0.4], seg: 200 },
      { r: 4.05, tube: 0.005, color: "#f0b429", opacity: 0.35, rot: [1.05, 0.5, -0.2], seg: 220 },
      { r: 2.7, tube: 0.003, color: "#4fe4ff", opacity: 0.5, rot: [1.5, 0.15, 0.25], seg: 180 },
    ],
    [],
  );
  return (
    <>
      {rings.map((ring, i) => (
        <mesh key={i} rotation={ring.rot as [number, number, number]}>
          <torusGeometry args={[ring.r, ring.tube, 12, ring.seg]} />
          <meshBasicMaterial color={ring.color} transparent opacity={ring.opacity} blending={AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
}

// Small glowing dots that travel along the orbital paths. Each dot lives in a
// group tilted to match a ring and moves on a circle in that group's plane.
function OrbitingDots() {
  const dots = useMemo(
    () => [
      { r: 3.05, speed: 0.35, phase: 0.0, color: "#8b5cf6", size: 0.11, rot: [1.15, 0.2, 0.1] },
      { r: 4.05, speed: -0.22, phase: 2.1, color: "#f0b429", size: 0.09, rot: [1.05, 0.5, -0.2] },
      { r: 2.7, speed: 0.5, phase: 4.0, color: "#4fe4ff", size: 0.08, rot: [1.5, 0.15, 0.25] },
      { r: 3.55, speed: 0.28, phase: 1.2, color: "#ff6ea9", size: 0.07, rot: [1.35, -0.35, 0.4] },
    ],
    [],
  );
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    dots.forEach((d, i) => {
      const m = refs.current[i];
      if (!m) return;
      const a = d.phase + t * d.speed;
      // circle in the parent group's local XY plane (matches torus default plane)
      m.position.set(Math.cos(a) * d.r, Math.sin(a) * d.r, 0);
    });
  });
  return (
    <>
      {dots.map((d, i) => (
        <group key={i} rotation={d.rot as [number, number, number]}>
          <mesh ref={(el) => { refs.current[i] = el; }}>
            <sphereGeometry args={[d.size, 16, 16]} />
            <meshBasicMaterial color={d.color} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// Scattered multicoloured stars in the deep background.
function ColorStars() {
  const { positions, colors } = useMemo(() => {
    const n = 420;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const palette = ["#4fe4ff", "#8b5cf6", "#f0b429", "#37d67a", "#ff6ea9", "#5c8bff"].map((c) => new Color(c));
    for (let i = 0; i < n; i++) {
      const rr = 6 + Math.random() * 12;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th) * 0.7;
      pos[i * 3 + 2] = -4 - Math.random() * 10;
      const c = palette[(Math.random() * palette.length) | 0];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);
  const pts = useRef<import("three").Points>(null);
  useFrame((s, dt) => { if (pts.current) pts.current.rotation.z += dt * 0.008; });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={colors.length / 3} />
      </bufferGeometry>
      <pointsMaterial size={0.11} sizeAttenuation vertexColors transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function OrbRig() {
  const g = useRef<Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    g.current.rotation.y = MathUtils.lerp(g.current.rotation.y, s.pointer.x * 0.18, 0.05);
    g.current.rotation.x = MathUtils.lerp(g.current.rotation.x, -s.pointer.y * 0.12, 0.05);
  });
  return (
    <group ref={g} scale={1.05}>
      <DarkPlanet />
      <GlowCore />
      <Rings />
      <OrbitingDots />
    </group>
  );
}

export default function OrbScene() {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 42 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.18} />
      <pointLight position={[-2, 1.5, 4]} intensity={1.5} color="#5ad0ff" />
      <pointLight position={[4, -2, 2]} intensity={0.55} color="#8b5cf6" />
      <ColorStars />
      <Sparkles count={40} scale={[14, 10, 6]} size={1.6} speed={0.25} opacity={0.4} color="#8fd4ff" />
      <OrbRig />
    </Canvas>
  );
}
