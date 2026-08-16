"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { AdditiveBlending, Color, type Group, type Mesh, MathUtils } from "three";

// Holographic wireframe human — the body users triage. Emissive cyan "scan" look.
function GlowHuman() {
  const mat = { transparent: true, opacity: 0.9, wireframe: true } as const;
  const cyan = "#5ce1ff";
  const parts = (
    <group>
      {/* head */}
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.34, 18, 18]} />
        <meshBasicMaterial color={cyan} {...mat} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.46, 1.0, 6, 16]} />
        <meshBasicMaterial color={cyan} {...mat} />
      </mesh>
      {/* arms */}
      <mesh position={[-0.62, 0.95, 0]} rotation={[0, 0, 0.16]}>
        <capsuleGeometry args={[0.15, 1.3, 5, 12]} />
        <meshBasicMaterial color={cyan} {...mat} />
      </mesh>
      <mesh position={[0.62, 0.95, 0]} rotation={[0, 0, -0.16]}>
        <capsuleGeometry args={[0.15, 1.3, 5, 12]} />
        <meshBasicMaterial color={cyan} {...mat} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.24, -0.75, 0]}>
        <capsuleGeometry args={[0.19, 1.5, 5, 12]} />
        <meshBasicMaterial color={cyan} {...mat} />
      </mesh>
      <mesh position={[0.24, -0.75, 0]}>
        <capsuleGeometry args={[0.19, 1.5, 5, 12]} />
        <meshBasicMaterial color={cyan} {...mat} />
      </mesh>
    </group>
  );

  return (
    <group>
      {/* soft translucent fill behind the wireframe for volume */}
      <group>{parts}</group>
      {/* aura glow */}
      <mesh position={[0, 0.5, -0.4]}>
        <circleGeometry args={[2.2, 48]} />
        <meshBasicMaterial color="#1b6bff" transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// A horizontal ring that sweeps up and down the body — a medical scan line.
function ScanRing() {
  const m = useRef<Mesh>(null);
  useFrame((s) => {
    if (!m.current) return;
    const t = s.clock.elapsedTime;
    m.current.position.y = Math.sin(t * 0.9) * 1.9 + 0.4;
    const mm = m.current.material as { opacity: number };
    mm.opacity = 0.5 + Math.sin(t * 0.9) * 0.2;
  });
  return (
    <mesh ref={m} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.85, 0.02, 8, 64]} />
      <meshBasicMaterial color="#eaffff" transparent opacity={0.6} blending={AdditiveBlending} />
    </mesh>
  );
}

// Heartbeat pulse rings expanding outward from the chest.
function PulseRings() {
  const refs = useRef<(Mesh | null)[]>([]);
  const count = 3;
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const p = ((t * 0.5 + i / count) % 1);
      const sc = 0.6 + p * 3.4;
      m.scale.set(sc, sc, sc);
      (m.material as { opacity: number }).opacity = (1 - p) * 0.4;
    }
  });
  return (
    <group position={[0, 0.85, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <torusGeometry args={[1, 0.014, 8, 80]} />
          <meshBasicMaterial color="#37d67a" transparent opacity={0.3} blending={AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

// Rotating DNA double helix — genetic / medical motif.
function DNAHelix() {
  const g = useRef<Group>(null);
  const nodes = useMemo(() => {
    const arr: { y: number; a: number }[] = [];
    const turns = 3, per = 10, n = turns * per;
    for (let i = 0; i < n; i++) arr.push({ y: (i / n) * 3.6 - 1.8, a: (i / per) * Math.PI });
    return arr;
  }, []);
  useFrame((s, dt) => { if (g.current) g.current.rotation.y += dt * 0.6; });
  return (
    <group ref={g} position={[3.5, 0, -1]} scale={0.72}>
      {nodes.map((nd, i) => {
        const x1 = Math.cos(nd.a) * 0.5, z1 = Math.sin(nd.a) * 0.5;
        const x2 = Math.cos(nd.a + Math.PI) * 0.5, z2 = Math.sin(nd.a + Math.PI) * 0.5;
        return (
          <group key={i} position={[0, nd.y, 0]}>
            <mesh position={[x1, 0, z1]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshBasicMaterial color="#4fe4ff" />
            </mesh>
            <mesh position={[x2, 0, z2]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshBasicMaterial color="#8b5cf6" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Faint concentric orbital rings + traveling dots for depth.
function Orbits() {
  const dots = useMemo(
    () => [
      { r: 3.2, speed: 0.3, phase: 0, color: "#f0b429", size: 0.09, rot: [1.15, 0.2, 0.1] },
      { r: 3.9, speed: -0.2, phase: 2, color: "#8b5cf6", size: 0.08, rot: [1.05, 0.5, -0.2] },
      { r: 2.9, speed: 0.44, phase: 4, color: "#4fe4ff", size: 0.07, rot: [1.5, 0.15, 0.25] },
    ],
    [],
  );
  const rings = useMemo(
    () => [
      { r: 3.2, color: "#f0b429", opacity: 0.4, rot: [1.15, 0.2, 0.1] },
      { r: 3.9, color: "#8b5cf6", opacity: 0.3, rot: [1.05, 0.5, -0.2] },
      { r: 2.9, color: "#4fe4ff", opacity: 0.35, rot: [1.5, 0.15, 0.25] },
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
      m.position.set(Math.cos(a) * d.r, Math.sin(a) * d.r, 0);
    });
  });
  return (
    <group position={[0, 0.4, 0]}>
      {rings.map((r, i) => (
        <mesh key={i} rotation={r.rot as [number, number, number]}>
          <torusGeometry args={[r.r, 0.005, 10, 180]} />
          <meshBasicMaterial color={r.color} transparent opacity={r.opacity} blending={AdditiveBlending} />
        </mesh>
      ))}
      {dots.map((d, i) => (
        <group key={i} rotation={d.rot as [number, number, number]}>
          <mesh ref={(el) => { refs.current[i] = el; }}>
            <sphereGeometry args={[d.size, 12, 12]} />
            <meshBasicMaterial color={d.color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ColorStars() {
  const { positions, colors } = useMemo(() => {
    const n = 360;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const palette = ["#4fe4ff", "#8b5cf6", "#f0b429", "#37d67a", "#5c8bff"].map((c) => new Color(c));
    for (let i = 0; i < n; i++) {
      const rr = 6 + Math.random() * 11;
      const th = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(th) * rr;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = -4 - Math.random() * 9;
      const c = palette[(Math.random() * palette.length) | 0];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);
  const pts = useRef<import("three").Points>(null);
  useFrame((s, dt) => { if (pts.current) pts.current.rotation.z += dt * 0.006; });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={colors.length / 3} />
      </bufferGeometry>
      <pointsMaterial size={0.1} sizeAttenuation vertexColors transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function Rig() {
  const g = useRef<Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    g.current.rotation.y = MathUtils.lerp(g.current.rotation.y, s.pointer.x * 0.25, 0.05);
    g.current.rotation.x = MathUtils.lerp(g.current.rotation.x, -s.pointer.y * 0.12, 0.05);
  });
  return (
    <group ref={g}>
      <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.4}>
        <GlowHuman />
        <ScanRing />
        <PulseRings />
      </Float>
      <DNAHelix />
      <Orbits />
    </group>
  );
}

export default function MedicalHero() {
  return (
    <Canvas camera={{ position: [0.4, 0.3, 9], fov: 44 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[-3, 3, 4]} intensity={1.6} color="#5ad0ff" />
      <pointLight position={[4, -2, 2]} intensity={0.6} color="#8b5cf6" />
      <ColorStars />
      <Sparkles count={36} scale={[13, 10, 6]} size={1.5} speed={0.25} opacity={0.4} color="#8fd4ff" />
      <Rig />
    </Canvas>
  );
}
