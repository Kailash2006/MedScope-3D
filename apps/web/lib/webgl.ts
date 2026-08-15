// Capability detection for choosing the 3D view vs. the accessible 2D fallback.

export function detectWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Use the lightweight 2D body map when WebGL is unavailable OR the user asked to
// reduce motion (low-power / accessibility preference). Not a React hook — plain
// predicate, so it is safe to call inside effects.
export function lowPowerBodyMapPreferred(): boolean {
  return !detectWebGL() || prefersReducedMotion();
}
