import type { Assessment } from "./types";

export type SocketStatus = "connecting" | "open" | "closed" | "error";

export interface SocketHandlers {
  onStatus?: (s: SocketStatus) => void;
  onConnected?: (latest: unknown) => void;
  onAssessment?: (a: Assessment) => void;
  onSaved?: () => void;
  onError?: (message: unknown) => void;
}

type WSFactory = (url: string) => WebSocket;

/**
 * Thin WebSocket client for a triage session: sends update patches, surfaces
 * live assessments, and auto-reconnects with backoff. The socket factory is
 * injectable so it can be unit-tested without a real server.
 */
export class TriageSocket {
  private ws: WebSocket | null = null;
  private closedByUs = false;
  private backoff = 500;

  constructor(
    private url: string,
    private handlers: SocketHandlers,
    private factory: WSFactory = (u) => new WebSocket(u),
  ) {}

  connect(): void {
    this.closedByUs = false;
    this.handlers.onStatus?.("connecting");
    const ws = this.factory(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 500;
      this.handlers.onStatus?.("open");
    };
    ws.onmessage = (ev: MessageEvent) => this.handleMessage(ev.data);
    ws.onerror = () => this.handlers.onStatus?.("error");
    ws.onclose = () => {
      this.handlers.onStatus?.("closed");
      if (!this.closedByUs) this.scheduleReconnect();
    };
  }

  handleMessage(raw: unknown): void {
    let msg: { type?: string; data?: Assessment; latest?: unknown; message?: unknown };
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : (raw as object);
    } catch {
      return;
    }
    switch (msg.type) {
      case "connected":
        this.handlers.onConnected?.(msg.latest);
        break;
      case "assessment":
        if (msg.data) this.handlers.onAssessment?.(msg.data);
        break;
      case "saved":
        this.handlers.onSaved?.();
        break;
      case "error":
        this.handlers.onError?.(msg.message);
        break;
    }
  }

  sendUpdate(patch: unknown): void {
    // 1 === WebSocket.OPEN (avoid depending on a global WebSocket constant).
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type: "update", patch }));
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(this.backoff, 8000);
    this.backoff *= 2;
    setTimeout(() => {
      if (!this.closedByUs) this.connect();
    }, delay);
  }

  close(): void {
    this.closedByUs = true;
    this.ws?.close();
    this.ws = null;
  }
}
