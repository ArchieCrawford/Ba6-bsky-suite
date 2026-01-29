import { ENV } from "./env";
import { supabase } from "./supabase";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; payload?: any };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const base = ENV.BA6_API_BASE.replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string>)
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, error: payload?.error ?? res.statusText, payload };
  }
  return { ok: true, data: payload as T };
}
