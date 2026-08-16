import { describe, it, expect } from "vitest";
import { visibleQuestions } from "../components/RedFlagQuestions";
import { emptyState } from "../lib/types";
import type { RegionCode } from "../lib/regions";

describe("RedFlagQuestions visibility", () => {
  it("shows nothing with no input", () => {
    expect(visibleQuestions(emptyState(), new Set())).toHaveLength(0);
  });

  it("asks chest-pain-related follow-ups when a chest region is selected", () => {
    const state = { ...emptyState(), regions: ["chest_left"] as RegionCode[] };
    const qs = visibleQuestions(state, new Set());
    expect(qs.some((q) => q.id === "chest-pain")).toBe(true);
  });

  it("asks radiation/SOB follow-ups once chest_pain is present, and hides answered ones", () => {
    const state = { ...emptyState(), regions: ["chest_left"] as RegionCode[], symptoms: [{ code: "chest_pain", severity: 7, duration_hours: null }] };
    const qs = visibleQuestions(state, new Set());
    // chest-pain is now satisfied (present) so it drops off; radiate/sob/risk appear
    expect(qs.some((q) => q.id === "chest-pain")).toBe(false);
    expect(qs.some((q) => q.id === "chest-radiate")).toBe(true);
    // answered questions are excluded
    const answered = new Set(["chest-radiate"]);
    expect(visibleQuestions(state, answered).some((q) => q.id === "chest-radiate")).toBe(false);
  });

  it("asks head red-flags when head + headache present", () => {
    const state = { ...emptyState(), regions: ["head"] as RegionCode[], symptoms: [{ code: "headache", severity: 5, duration_hours: null }] };
    const ids = visibleQuestions(state, new Set()).map((q) => q.id);
    expect(ids).toContain("head-neck");
  });
});
