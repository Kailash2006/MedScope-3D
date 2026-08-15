import { describe, it, expect } from "vitest";
import { detectWebGL, prefersReducedMotion, lowPowerBodyMapPreferred } from "../lib/webgl";

// jsdom has no WebGL context, so detection should be false and the low-power
// (2D) map should be chosen — which is exactly the fallback path we want covered.
describe("capability detection", () => {
  it("detectWebGL is false under jsdom (no GL context)", () => {
    expect(detectWebGL()).toBe(false);
  });

  it("prefersReducedMotion returns a boolean", () => {
    if (!window.matchMedia) {
      window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
    }
    expect(typeof prefersReducedMotion()).toBe("boolean");
  });

  it("falls back to the 2D body map when WebGL is unavailable", () => {
    expect(lowPowerBodyMapPreferred()).toBe(true);
  });
});
