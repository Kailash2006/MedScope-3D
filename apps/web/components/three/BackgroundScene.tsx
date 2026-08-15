"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { AdditiveBlending, Color, type Group, type Points, MathUtils } from "three";

// Drifting particle field that reacts to pointer.
function Starfield() {
  const pts = useRef<Points>(null);
  const positions = useMemo(() => {
    const n = 1300;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 64;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 42;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }
    return arr;
  }, []);

  useFrame((s, dt) => {
    if (!pts.current) return;
    pts.current.rotation.y += dt * 0.012;
    pts.current.rotation.x = MathUtils.lerp(pts.current.rotation.x, s.pointer.y * 0.06, 0.04);
  });

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        color={new Color("#5cc8ff")}
        transparent
        opacity={0.65}
        sizeAttenuation
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Slowly tumbling wireframe solids for depth.
function Shapes() {
  const shapes = useMemo(
    () => [
      { pos: [-9, 3, -8], r: 2.4, color: "#22d3ee", detail: 0 },
      { pos: [10, -4, -10], r: 3.1, color: "#818cf8", detail: 1 },
      { pos: [7, 6, -14], r: 2.0, color: "#38bdf8", detail: 0 },
      { pos: [-11, -6, -12], r: 2.7, color: "#4fe4ff", detail: 0 },
    ] as { pos: [number, number, number]; r: number; color: string; detail: number }[],
    [],
  );
  return (
    <>
      {shapes.map((sh, i) => (
        <Float key={i} speed={1 + i * 0.25} rotationIntensity={0.9} floatIntensity={1.4}>
          <mesh position={sh.pos}>
            <icosahedronGeometry args={[sh.r, sh.detail]} />
            <meshBasicMaterial color={sh.color} wireframe transparent opacity={0.16} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

// Parallax rig: the whole field leans toward the pointer and drifts on scroll.
function Rig() {
  const g = useRef<Group>(null);
  const scroll = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll.current = max > 0 ? window.scrollY / max : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useFrame((s) => {
    if (!g.current) return;
    g.current.rotation.y = MathUtils.lerp(g.current.rotation.y, s.pointer.x * 0.22, 0.04);
    g.current.rotation.x = MathUtils.lerp(g.current.rotation.x, -s.pointer.y * 0.14 + scroll.current * 0.35, 0.04);
    g.current.position.y = MathUtils.lerp(g.current.position.y, scroll.current * 6, 0.05);
  });

  return (
    <group ref={g}>
      <Starfield />
      <Shapes />
    </group>
  );
}

export default function BackgroundScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <fog attach="fog" args={["#05070e", 16, 34]} />
      <Rig />
    </Canvas>
  );
}
