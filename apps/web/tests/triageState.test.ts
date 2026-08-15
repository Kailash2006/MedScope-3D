import { describe, it, expect } from "vitest";
import { reducer, toPatch } from "../lib/triageState";
import { emptyState } from "../lib/types";

describe("triage reducer", () => {
  it("toggles regions on and off", () => {
    let s = reducer(emptyState(), { type: "toggleRegion", code: "chest_left" });
    expect(s.regions).toEqual(["chest_left"]);
    s = reducer(s, { type: "toggleRegion", code: "chest_left" });
    expect(s.regions).toEqual([]);
  });

  it("adds a symptom once and updates severity", () => {
    let s = reducer(emptyState(), { type: "addSymptom", code: "chest_pain" });
    s = reducer(s, { type: "addSymptom", code: "chest_pain" }); // dedup
    expect(s.symptoms).toHaveLength(1);
    expect(s.symptoms[0].severity).toBe(5);
    s = reducer(s, { type: "updateSymptom", index: 0, patch: { severity: 9 } });
    expect(s.symptoms[0].severity).toBe(9);
  });

  it("sets and clears a vital", () => {
    let s = reducer(emptyState(), { type: "setVital", key: "spo2", value: 88 });
    expect(s.vitals.spo2).toBe(88);
    s = reducer(s, { type: "setVital", key: "spo2", value: null });
    expect(s.vitals.spo2).toBeNull();
  });
});

describe("toPatch", () => {
  it("drops null/NaN vitals and shapes symptoms", () => {
    let s = emptyState();
    s = reducer(s, { type: "setVital", key: "spo2", value: 88 });
    s = reducer(s, { type: "setVital", key: "hr", value: null });
    s = reducer(s, { type: "addSymptom", code: "headache" });
    const patch = toPatch(s);
    expect(patch.vitals).toEqual({ spo2: 88 });
    expect(patch.symptoms[0]).toEqual({ code: "headache", severity: 5, duration_hours: null });
  });
});
