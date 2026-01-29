import { BskyAgent } from "@atproto/api";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AtprotoSessionRow = {
  id: string;
  user_id: string;
  provider: string;
  did: string;
  handle: string | null;
  pds_url: string | null;
  access_jwt: string;
  refresh_jwt: string;
  expires_at: string | null;
};

export class AtprotoSessionError extends Error {
  status: number;
  reason: string;
  constructor(message: string, reason: string, status = 409) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

export function isAtprotoSessionError(err: any): err is AtprotoSessionError {
  return Boolean(err && typeof err === "object" && "reason" in err && "status" in err);
}

function isAuthError(err: any) {
  return err?.status === 401 || err?.error === "ExpiredToken" || err?.message?.includes("Expired");
}

function normalizeHandle(handle?: string | null, fallback?: string) {
  if (handle && handle.trim()) return handle.trim();
  return fallback ?? "";
}

function buildSession(session: AtprotoSessionRow) {
  return {
    accessJwt: session.access_jwt,
    refreshJwt: session.refresh_jwt,
    did: session.did,
    handle: normalizeHandle(session.handle, session.did)
  };
}

export async function getAtprotoSessionForUser(
  supa: SupabaseClient<any, "public", any>,
  userId: string
): Promise<AtprotoSessionRow> {
  const { data, error } = await supa
    .from("atproto_sessions")
    .select("id,user_id,provider,did,handle,pds_url,access_jwt,refresh_jwt,expires_at")
    .eq("user_id", userId)
    .eq("provider", "bluesky")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new AtprotoSessionError("Bluesky auth required", "bluesky_auth_required", 409);
  }
  return data as AtprotoSessionRow;
}

export async function withChatAgent<T>(
  supa: SupabaseClient<any, "public", any>,
  userId: string,
  fn: (agent: BskyAgent) => Promise<T>
): Promise<T> {
  const session = await getAtprotoSessionForUser(supa, userId);
  const pdsUrl = session.pds_url ?? process.env.BLUESKY_SERVICE ?? "https://bsky.social";
  const chatService = process.env.BSKY_CHAT_SERVICE ?? "https://api.bsky.chat";

  const pdsAgent = new BskyAgent({ service: pdsUrl });
  await pdsAgent.resumeSession(buildSession(session));

  const chatAgent = new BskyAgent({ service: chatService });
  await chatAgent.resumeSession(buildSession(session));

  try {
    return await fn(chatAgent);
  } catch (err: any) {
    if (!isAuthError(err)) throw err;

    await pdsAgent.refreshSession();
    const refreshed = pdsAgent.session;
    if (!refreshed) {
      throw new AtprotoSessionError("Bluesky session expired", "bluesky_auth_required", 409);
    }

    await supa
      .from("atproto_sessions")
      .update({
        access_jwt: refreshed.accessJwt,
        refresh_jwt: refreshed.refreshJwt,
        did: refreshed.did,
        handle: refreshed.handle ?? session.handle,
        pds_url: session.pds_url ?? pdsUrl
      })
      .eq("id", session.id);

    await chatAgent.resumeSession({
      accessJwt: refreshed.accessJwt,
      refreshJwt: refreshed.refreshJwt,
      did: refreshed.did,
      handle: normalizeHandle(refreshed.handle, refreshed.did)
    });

    return await fn(chatAgent);
  }
}
