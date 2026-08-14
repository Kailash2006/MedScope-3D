import { describe, it, expect } from "vitest";
import { URGENCY_LEVELS, escalate } from "@medscope/triage-shared";

describe("web consumes shared triage contract", () => {
  it("has the six urgency levels", () => {
    expect(URGENCY_LEVELS).toContain("EMERGENCY");
    expect(URGENCY_LEVELS).toHaveLength(6);
  });

  it("re-exports the escalate-only safety invariant", () => {
    expect(escalate("ROUTINE", "EMERGENCY")).toBe("EMERGENCY");
  });
});
