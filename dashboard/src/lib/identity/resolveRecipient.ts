import { createSupabaseServiceClient } from "@/lib/supabaseServer";

const HANDLE_RESOLVE_ENDPOINT =
  process.env.BLUESKY_PUBLIC_API ?? "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle";

export type ResolvedRecipient = {
  did: string;
  handle?: string | null;
  source: "did" | "handle" | "username";
};

async function resolveHandle(handle: string) {
  const url = `${HANDLE_RESOLVE_ENDPOINT}?handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const payload = await res.json().catch(() => null);
  const did = payload?.did;
  if (typeof did === "string" && did.startsWith("did:")) {
    return { did } as { did: string };
  }
  return null;
}

export async function resolveRecipient(input: string): Promise<ResolvedRecipient> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Missing recipient");
  }

  if (trimmed.startsWith("did:")) {
    return { did: trimmed, source: "did" };
  }

  const service = createSupabaseServiceClient();

  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).trim();
    if (!handle) throw new Error("Missing handle");
    const resolved = await resolveHandle(handle);
    if (resolved) {
      return { did: resolved.did, handle, source: "handle" };
    }

    const username = handle.toLowerCase();
    const { data } = await service.from("identities").select("did,handle,username").eq("username", username).maybeSingle();
    if (data?.did) {
      return { did: data.did, handle: data.handle ?? null, source: "username" };
    }
    throw new Error("Handle or username not found");
  }

  const username = trimmed.toLowerCase();
  const { data: userRow } = await service
    .from("identities")
    .select("did,handle,username")
    .eq("username", username)
    .maybeSingle();
  if (userRow?.did) {
    return { did: userRow.did, handle: userRow.handle ?? null, source: "username" };
  }

  if (trimmed.includes(".")) {
    const resolved = await resolveHandle(trimmed);
    if (resolved) {
      return { did: resolved.did, handle: trimmed, source: "handle" };
    }
  }

  throw new Error("Username not found");
}
