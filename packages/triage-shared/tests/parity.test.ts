import { describe, it, expect } from "vitest";
import { URGENCY_LEVELS, rankOf, escalate, type UrgencyLevel } from "../src/urgency";
import urgencyJson from "../schema/urgency.json";

describe("UrgencyLevel parity (TS <-> canonical JSON)", () => {
  it("TS levels match the JSON canonical order", () => {
    expect(URGENCY_LEVELS).toEqual(urgencyJson.levels.map((l) => l.value));
  });

  it("EMERGENCY is the highest rank", () => {
    const ranks = urgencyJson.levels.map((l) => l.rank);
    expect(rankOf("EMERGENCY")).toBe(Math.max(...ranks));
  });

  it("INSUFFICIENT_INFO ranks 0 and never wins the escalate merge", () => {
    expect(rankOf("INSUFFICIENT_INFO")).toBe(0);
    expect(escalate("SELF_CARE", "INSUFFICIENT_INFO")).toBe("SELF_CARE");
  });
});

describe("escalate() safety invariant", () => {
  it("always returns the more-urgent level (never downgrades)", () => {
    const pairs: [UrgencyLevel, UrgencyLevel, UrgencyLevel][] = [
      ["ROUTINE", "EMERGENCY", "EMERGENCY"],
      ["EMERGENCY", "SELF_CARE", "EMERGENCY"],
      ["DOCTOR_SOON", "URGENT_TODAY", "URGENT_TODAY"],
    ];
    for (const [a, b, expected] of pairs) {
      expect(escalate(a, b)).toBe(expected);
    }
  });
});
