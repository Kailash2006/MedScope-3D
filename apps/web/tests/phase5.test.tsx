import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { VitalsChart } from "../components/charts/VitalsChart";

// Mock the API module for HistoryPanel + admin page.
vi.mock("../lib/api", () => ({
  getTimeline: vi.fn(),
  reportUrl: (id: string) => `http://api/api/v1/sessions/${id}/report.pdf`,
  adminDashboard: vi.fn(),
}));
import * as api from "../lib/api";
import { HistoryPanel } from "../components/HistoryPanel";

describe("VitalsChart", () => {
  it("shows the latest value and renders points", () => {
    const { container } = render(
      <VitalsChart title="SpO₂" unit="%" series={[{ t: "a", v: 95 }, { t: "b", v: 88 }]} />,
    );
    expect(screen.getByText("88 %")).toBeInTheDocument();
    expect(container.querySelector("polyline")).toBeTruthy();
    expect(container.querySelectorAll("circle").length).toBe(2);
  });

  it("renders a no-data state when empty", () => {
    render(<VitalsChart title="HR" unit="bpm" series={[{ t: "a", v: null }]} />);
    expect(screen.getByText("no data")).toBeInTheDocument();
  });
});

describe("HistoryPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the timeline and a PDF link once data loads", async () => {
    (api.getTimeline as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { at: "2026-08-14T10:00:00Z", urgency: "EMERGENCY", decision_path: "VITALS_RED_FLAG", confidence: 0.99, vitals: { spo2: 85 }, symptoms: [] },
    ]);
    render(<HistoryPanel sessionId="sess-1" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText("Emergency")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Clinician PDF/i });
    expect(link).toHaveAttribute("href", "http://api/api/v1/sessions/sess-1/report.pdf");
  });

  it("shows an empty state before any history", () => {
    (api.getTimeline as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<HistoryPanel sessionId={null} refreshKey={0} />);
    expect(screen.getByText(/No history yet/i)).toBeInTheDocument();
  });
});
