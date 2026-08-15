"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { RegionCode } from "../lib/regions";
import { lowPowerBodyMapPreferred } from "../lib/webgl";
import { ErrorBoundary } from "./ErrorBoundary";
import { RegionSelector } from "./RegionSelector";
import { SvgBodyMap } from "./SvgBodyMap";

const BodyCanvas = dynamic(() => import("./three/BodyCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 360, display: "grid", placeItems: "center", color: "#94a3b8" }}>
      Loading 3D view…
    </div>
  ),
});

interface Props {
  selected: RegionCode[];
  onToggle: (code: RegionCode) => void;
  urgency?: string;
}

export function BodyMapper({ selected, onToggle, urgency }: Props) {
  // Default to the safe 2D map until we can detect capability on the client.
  const [use3D, setUse3D] = useState(false);
  const [autoLowPower, setAutoLowPower] = useState(true);

  useEffect(() => {
    const low = lowPowerBodyMapPreferred();
    setAutoLowPower(low);
    setUse3D(!low);
  }, []);

  return (
    <section aria-labelledby="mapper-heading">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 id="mapper-heading" style={{ fontSize: "1.05rem", margin: "0 0 .5rem" }}>
          Where does it hurt?
        </h2>
        <button
          type="button"
          onClick={() => setUse3D((v) => !v)}
          style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: ".25rem .5rem", cursor: "pointer", fontSize: ".8rem" }}
        >
          {use3D ? "Use 2D map" : "Use 3D view"}
        </button>
      </div>

      {use3D ? (
        <ErrorBoundary fallback={<div style={{ display: "grid", placeItems: "center" }}><SvgBodyMap selected={selected} onToggle={onToggle} urgency={urgency} /></div>}>
          <BodyCanvas selected={selected} onToggle={onToggle} urgency={urgency} />
        </ErrorBoundary>
      ) : (
        <div style={{ display: "grid", placeItems: "center" }}>
          <SvgBodyMap selected={selected} onToggle={onToggle} urgency={urgency} />
          {autoLowPower && (
            <p style={{ color: "#94a3b8", fontSize: ".78rem", marginTop: ".4rem" }}>
              2D view (WebGL unavailable or reduced-motion preferred).
            </p>
          )}
        </div>
      )}

      <p style={{ color: "#94a3b8", fontSize: ".85rem", margin: ".75rem 0 .35rem" }}>
        Select the affected regions:
      </p>
      <RegionSelector selected={selected} onToggle={onToggle} />
    </section>
  );
}
