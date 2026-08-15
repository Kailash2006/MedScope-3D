import type { Assessment } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";

export interface SessionOut {
  id: string;
  status: string;
  latest_assessment: Assessment | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function createSession(age?: number | null, sex?: string | null): Promise<SessionOut> {
  const res = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ age: age ?? null, sex: sex ?? null }),
  });
  return json<SessionOut>(res);
}

export async function patchSession(id: string, patch: unknown): Promise<Assessment> {
  const res = await fetch(`${API_BASE}/api/v1/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return json<Assessment>(res);
}

export async function getHistory(id: string): Promise<Assessment[]> {
  return json<Assessment[]>(await fetch(`${API_BASE}/api/v1/sessions/${id}/history`));
}

export function sessionWsUrl(id: string): string {
  return `${WS_BASE}/ws/sessions/${id}`;
}

export interface TimelinePoint {
  at: string;
  urgency: string;
  decision_path: string;
  confidence: number;
  vitals: Record<string, number | null>;
  symptoms: { code: string; severity: number; duration_hours?: number | null }[];
}

export async function getTimeline(id: string): Promise<TimelinePoint[]> {
  return json<TimelinePoint[]>(await fetch(`${API_BASE}/api/v1/sessions/${id}/timeline`));
}

export function reportUrl(id: string): string {
  return `${API_BASE}/api/v1/sessions/${id}/report.pdf`;
}

export async function adminDashboard(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/v1/admin/dashboard`, {
    headers: { "X-Admin-Token": token },
  });
  if (res.status === 403) throw new Error("forbidden");
  return json<Record<string, unknown>>(res);
}
