"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { RegionCode } from "../lib/regions";
import { lowPowerBodyMapPreferred } from "../lib/webgl";
import { RegionSelector } from "./RegionSelector";
import { SvgBodyMap } from "./SvgBodyMap";

const BodyCanvas = dynamic(() => import("./three/BodyCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)" }}>
      <span className="live-dot" style={{ background: "var(--accent)", marginRight: 8 }} /> Loading 3D model…
    </div>
  ),
});

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

export function BodyMapper({ selected, onToggle, urgency }: Props) {
  const [use3D, setUse3D] = useState(false);
  const [autoLowPower, setAutoLowPower] = useState(true);

  useEffect(() => {
    const low = lowPowerBodyMapPreferred();
    setAutoLowPower(low);
    setUse3D(!low);
  }, []);

  return (
    <section aria-labelledby="mapper-heading" className="glass rise rise-2" style={{ padding: "1.1rem", position: "sticky", top: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".75rem" }}>
        <div>
          <p className="card-title" style={{ margin: 0 }}>Body map</p>
          <h2 id="mapper-heading" style={{ fontSize: "1.15rem", margin: ".1rem 0 0" }}>Where does it hurt?</h2>
        </div>
        <div className="seg" role="group" aria-label="Body map view mode">
          <button type="button" className="seg-btn" aria-pressed={use3D} onClick={() => setUse3D(true)}>3D</button>
          <button type="button" className="seg-btn" aria-pressed={!use3D} onClick={() => setUse3D(false)}>2D</button>
        </div>
      </div>

      <div
        className="glass-inset"
        style={{
          height: 420,
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(56,189,248,0.10), transparent 55%), rgba(4,9,18,0.6)",
        }}
      >
        {use3D ? (
          <BodyCanvas selected={selected} onToggle={onToggle} urgency={urgency} />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
            <SvgBodyMap selected={selected} onToggle={onToggle} urgency={urgency} />
          </div>
        )}
        {!use3D && autoLowPower && (
          <p style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", color: "var(--muted-2)", fontSize: ".72rem", margin: 0 }}>
            2D view · WebGL unavailable or reduced-motion
          </p>
        )}
        {use3D && (
          <p style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", color: "var(--muted-2)", fontSize: ".72rem", margin: 0, pointerEvents: "none" }}>
            drag to rotate · tap a region
          </p>
        )}
      </div>

      <p style={{ color: "var(--muted)", fontSize: ".8rem", margin: ".85rem 0 .4rem" }}>
        Select affected regions
      </p>
      <RegionSelector selected={selected} onToggle={onToggle} />
    </section>
  );
}
