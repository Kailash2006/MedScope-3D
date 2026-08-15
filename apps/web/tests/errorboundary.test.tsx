import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../components/ErrorBoundary";

function Boom(): JSX.Element {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(<ErrorBoundary fallback={<div>fallback</div>}><div>ok</div></ErrorBoundary>);
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("shows the fallback when a child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ErrorBoundary fallback={<div>degraded view</div>}><Boom /></ErrorBoundary>);
    expect(screen.getByText("degraded view")).toBeInTheDocument();
    spy.mockRestore();
    warn.mockRestore();
  });
});
