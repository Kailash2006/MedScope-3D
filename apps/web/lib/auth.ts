"use client";

// Client-side auth: JWT bearer stored in localStorage (the web app and API are
// on different domains, so cross-site cookies are unreliable). The token is sent
// as Authorization: Bearer on API calls.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const TOKEN_KEY = "medscope_auth_token";

export interface AuthUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Authorization header for the current token, or {} when logged out. */
export function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function authFetch<T>(path: string, body: { email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `${res.status} ${res.statusText}`);
  return data as { token: string; user: AuthUser };
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const { token, user } = await authFetch("register", { email, password });
  setToken(token);
  return user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { token, user } = await authFetch("login", { email, password });
  setToken(token);
  return user;
}

export function logout(): void {
  setToken(null);
}

export async function fetchMe(): Promise<AuthUser | null> {
  const t = getToken();
  if (!t) return null;
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    return null;
  }
  return (await res.json()) as AuthUser;
}

export interface MySession {
  id: string;
  created_at: string;
  latest_urgency: string | null;
  latest_decision_path: string | null;
  assessment_count: number;
  symptoms: { code: string }[];
}

export async function fetchMySessions(): Promise<MySession[]> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me/sessions`, { headers: authHeader() });
  if (!res.ok) return [];
  return (await res.json()) as MySession[];
}
