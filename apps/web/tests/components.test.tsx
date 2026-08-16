import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegionSelector } from "../components/RegionSelector";
import { SvgBodyMap } from "../components/SvgBodyMap";
import { RiskPanel } from "../components/RiskPanel";
import type { Assessment } from "../lib/types";

describe("RegionSelector", () => {
  it("reflects selection via aria-pressed and toggles on click", async () => {
    const onToggle = vi.fn();
    render(<RegionSelector selected={["chest_left"]} onToggle={onToggle} />);
    const chest = screen.getByRole("button", { name: "Chest (left)" });
    expect(chest).toHaveAttribute("aria-pressed", "true");
    const head = screen.getByRole("button", { name: "Head" });
    expect(head).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(head);
    expect(onToggle).toHaveBeenCalledWith("head");
  });
});

describe("SvgBodyMap", () => {
  it("renders an accessible labelled image and toggles a region on click", async () => {
    const onToggle = vi.fn();
    render(<SvgBodyMap selected={[]} onToggle={onToggle} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", expect.stringContaining("Body map"));
    await userEvent.click(screen.getByText("Head").parentElement!);
    expect(onToggle).toHaveBeenCalledWith("head");
  });
});

describe("RiskPanel", () => {
  const assessment: Assessment = {
    urgency: "EMERGENCY", confidence: 0.99,
    reasons: [{ type: "RED_FLAG", rule: "vitals.spo2_low", message: "Hypoxia" }],
    decision_path: "VITALS_RED_FLAG", advice: "Call emergency services now.",
    model_version: "v1.0.0", engine_version: "2026.08.1",
    disclaimer: "Not a diagnosis.", assessed_at: "2026-08-14T00:00:00Z",
  };

  it("shows urgency label, basis, and reasons", () => {
    render(<RiskPanel assessment={assessment} status="open" saved />);
    expect(screen.getByText("Emergency")).toBeInTheDocument();
    expect(screen.getByText("Vitals red flag")).toBeInTheDocument();
    expect(screen.getByText("Hypoxia")).toBeInTheDocument();
  });

  it("prompts for input when there is no assessment", () => {
    render(<RiskPanel assessment={null} status="connecting" saved={false} />);
    expect(screen.getByText(/Add symptoms or vitals/i)).toBeInTheDocument();
  });
});
