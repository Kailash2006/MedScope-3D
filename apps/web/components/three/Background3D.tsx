"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { lowPowerBodyMapPreferred } from "../../lib/webgl";

// The R3F scene is code-split so pages only pull three.js after paint,
// and never on no-WebGL / reduced-motion clients.
const BackgroundScene = dynamic(() => import("./BackgroundScene"), { ssr: false });

export function Background3D() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!lowPowerBodyMapPreferred());
  }, []);

  // On no-WebGL / reduced-motion, the CSS gradient backdrop stands in.
  if (!enabled) return null;

  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <BackgroundScene />
    </div>
  );
}
