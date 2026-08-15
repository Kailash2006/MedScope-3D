import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/api", () => ({
  exportSession: vi.fn().mockResolvedValue({ session: { id: "s1" } }),
  deleteSession: vi.fn().mockResolvedValue({ deleted: true, assessments_deleted: 2 }),
  setRetention: vi.fn().mockResolvedValue({}),
}));
import * as api from "../lib/api";
import { DataRightsPanel } from "../components/DataRightsPanel";

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom lacks object URL APIs used by the export download.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("DataRightsPanel", () => {
  it("sets retention", async () => {
    render(<DataRightsPanel sessionId="s1" onDeleted={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(api.setRetention).toHaveBeenCalledWith("s1", 30);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Retention set to 30/));
  });

  it("exports data as JSON", async () => {
    render(<DataRightsPanel sessionId="s1" onDeleted={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Export my data/i }));
    expect(api.exportSession).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Exported/));
  });

  it("requires a confirm step before deleting, then calls delete + onDeleted", async () => {
    const onDeleted = vi.fn();
    render(<DataRightsPanel sessionId="s1" onDeleted={onDeleted} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my data" }));
    expect(api.deleteSession).not.toHaveBeenCalled(); // not yet — needs confirm
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(api.deleteSession).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
