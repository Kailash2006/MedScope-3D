import { describe, it, expect, vi } from "vitest";
import { TriageSocket } from "../lib/ws";

class FakeWS {
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(data: string) { this.sent.push(data); }
  close() { this.onclose?.(); }
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

function makeSocket() {
  const fake = new FakeWS();
  const handlers = {
    onStatus: vi.fn(), onConnected: vi.fn(), onAssessment: vi.fn(),
    onSaved: vi.fn(), onError: vi.fn(),
  };
  const sock = new TriageSocket("ws://x", handlers, () => fake as unknown as WebSocket);
  sock.connect();
  return { fake, handlers, sock };
}

describe("TriageSocket", () => {
  it("routes server messages to the right handlers", () => {
    const { fake, handlers } = makeSocket();
    fake.emit({ type: "connected", latest: { urgency: "SELF_CARE" } });
    fake.emit({ type: "assessment", data: { urgency: "EMERGENCY" } });
    fake.emit({ type: "saved" });
    fake.emit({ type: "error", message: "bad" });

    expect(handlers.onConnected).toHaveBeenCalledWith({ urgency: "SELF_CARE" });
    expect(handlers.onAssessment).toHaveBeenCalledWith({ urgency: "EMERGENCY" });
    expect(handlers.onSaved).toHaveBeenCalled();
    expect(handlers.onError).toHaveBeenCalledWith("bad");
  });

  it("sends update patches wrapped in the protocol envelope", () => {
    const { fake, sock } = makeSocket();
    sock.sendUpdate({ vitals: { spo2: 90 } });
    expect(JSON.parse(fake.sent[0])).toEqual({ type: "update", patch: { vitals: { spo2: 90 } } });
  });

  it("does not send when the socket is not open", () => {
    const { fake, sock } = makeSocket();
    fake.readyState = 0;
    sock.sendUpdate({ x: 1 });
    expect(fake.sent).toHaveLength(0);
  });

  it("ignores malformed messages without throwing", () => {
    const { sock, handlers } = makeSocket();
    sock.handleMessage("not json{");
    expect(handlers.onAssessment).not.toHaveBeenCalled();
  });
});
