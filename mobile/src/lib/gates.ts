import { apiFetch } from "./api";

export type GateCheckPayload = {
  target_type: "space" | "feed" | "dm" | "thread";
  target_id: string;
  action: string;
};

export type GateCheckResult =
  | { ok: true }
  | { ok: false; reason: string; message?: string; status?: number; checkout_url?: string };

export async function checkGate(payload: GateCheckPayload) {
  const res = await apiFetch<any>("/api/gates/check", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const status = res.status;
    const reason = res.payload?.reason ?? res.payload?.error ?? "blocked";
    return { ok: false, reason, message: res.error, status } as GateCheckResult;
  }
  if (res.data?.ok === true) return { ok: true } as GateCheckResult;
  if (res.data?.ok === false) return res.data as GateCheckResult;
  return { ok: true } as GateCheckResult;
}

export async function joinSpace(spaceId: string) {
  const res = await apiFetch<any>("/api/spaces/join", {
    method: "POST",
    body: JSON.stringify({ space_id: spaceId })
  });
  if (!res.ok) {
    const reason = res.payload?.reason ?? res.payload?.error ?? "join_failed";
    return { ok: false, reason, message: res.error, status: res.status } as GateCheckResult;
  }
  if (res.data?.ok === false) return res.data as GateCheckResult;
  return { ok: true } as GateCheckResult;
}
