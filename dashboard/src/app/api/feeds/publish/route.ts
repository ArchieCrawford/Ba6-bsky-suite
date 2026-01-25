import { BskyAgent } from "@atproto/api";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

type SupabaseClientAny = SupabaseClient<any, "public", any>;

type PublishRequest = {
  feedId?: string;
  slug?: string;
  accountDid?: string;
  handle?: string;
};

type FeedRow = {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  description: string | null;
};

type AccountRow = { user_id: string; did: string; handle: string; service: string };

type SessionRow = {
  user_id: string;
  account_did: string;
  access_jwt: string;
  refresh_jwt: string;
  expires_at: string;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function isRecordNotFound(err: any) {
  return err?.error === "RecordNotFound" || err?.status === 404;
}

function normalizeDescription(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function recordsMatch(existing: any, next: { did: string; displayName: string; description?: string }) {
  if (!existing) return false;
  const existingDescription = normalizeDescription(existing.description);
  const nextDescription = normalizeDescription(next.description);
  return (
    existing.did === next.did &&
    existing.displayName === next.displayName &&
    (existingDescription ?? "") === (nextDescription ?? "")
  );
}

async function fetchFeed(supa: SupabaseClientAny, input: PublishRequest, userId: string): Promise<FeedRow> {
  if (!input.feedId && !input.slug) {
    throw new Error("Missing feed id or slug");
  }
  let query = supa.from("feeds").select("id,user_id,slug,display_name,description").eq("user_id", userId);
  if (input.feedId) {
    query = query.eq("id", input.feedId);
  } else if (input.slug) {
    query = query.eq("slug", input.slug);
  }
  const { data, error } = await query.limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Feed not found");
  }
  return data[0] as FeedRow;
}

async function fetchAccount(
  supa: SupabaseClientAny,
  userId: string,
  accountDid?: string,
  handle?: string
): Promise<AccountRow> {
  let query = supa.from("bsky_accounts").select("user_id,did,handle,service").eq("user_id", userId);
  if (accountDid) query = query.eq("did", accountDid);
  if (handle) query = query.eq("handle", handle);
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No Bluesky account found");
  }
  if (data.length > 1) {
    throw new Error("Multiple Bluesky accounts found; select one");
  }
  return data[0] as AccountRow;
}

async function fetchSession(supa: SupabaseClientAny, userId: string, did: string): Promise<SessionRow> {
  const { data, error } = await supa
    .from("bsky_sessions")
    .select("user_id,account_did,access_jwt,refresh_jwt,expires_at")
    .eq("user_id", userId)
    .eq("account_did", did)
    .single();
  if (error) throw error;
  return data as SessionRow;
}

async function saveSession(
  supa: SupabaseClientAny,
  userId: string,
  did: string,
  accessJwt: string,
  refreshJwt: string,
  expiresAt: Date
) {
  const now = new Date().toISOString();
  const { error } = await supa
    .from("bsky_sessions")
    .upsert(
      {
        user_id: userId,
        account_did: did,
        access_jwt: accessJwt,
        refresh_jwt: refreshJwt,
        expires_at: expiresAt.toISOString(),
        updated_at: now
      },
      { onConflict: "user_id,account_did" }
    );
  if (error) throw error;
}

async function resumeAgentSession(supa: SupabaseClientAny, account: AccountRow, session: SessionRow) {
  const agent = new BskyAgent({ service: account.service });
  await agent.resumeSession({
    did: account.did,
    handle: account.handle,
    email: undefined,
    accessJwt: session.access_jwt,
    refreshJwt: session.refresh_jwt,
    active: true
  });

  const now = Date.now();
  const exp = new Date(session.expires_at).getTime();
  if (exp - now < 30_000) {
    const refreshed = await agent.api.com.atproto.server.refreshSession(undefined, {
      headers: { authorization: `Bearer ${session.refresh_jwt}` }
    });
    const newAccess = refreshed.data.accessJwt;
    const newRefresh = refreshed.data.refreshJwt;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await saveSession(supa, account.user_id, account.did, newAccess, newRefresh, expiresAt);
    await agent.resumeSession({
      did: account.did,
      handle: refreshed.data.handle ?? account.handle,
      email: undefined,
      accessJwt: newAccess,
      refreshJwt: newRefresh,
      active: true
    });
  }

  return agent;
}

export async function POST(request: Request) {
  try {
    const supa: SupabaseClientAny = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false }
    });
    const feedgenDid = requireEnv("FEEDGEN_SERVICE_DID");
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const { data, error: authError } = await supa.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const input = (await request.json().catch(() => ({}))) as PublishRequest;
    const feed = await fetchFeed(supa, input, data.user.id);
    const account = await fetchAccount(supa, data.user.id, input.accountDid, input.handle);
    const session = await fetchSession(supa, data.user.id, account.did);
    const agent = await resumeAgentSession(supa, account, session);

    let existingRecord: any = null;
    try {
      const res = await agent.api.com.atproto.repo.getRecord({
        repo: account.did,
        collection: "app.bsky.feed.generator",
        rkey: feed.slug
      });
      existingRecord = res.data.value;
    } catch (err: any) {
      if (!isRecordNotFound(err)) {
        throw err;
      }
    }

    const createdAt =
      typeof existingRecord?.createdAt === "string" ? existingRecord.createdAt : new Date().toISOString();
    const record = {
      did: feedgenDid,
      displayName: feed.display_name,
      ...(feed.description ? { description: feed.description } : {}),
      createdAt
    };

    const uri = `at://${account.did}/app.bsky.feed.generator/${feed.slug}`;
    if (recordsMatch(existingRecord, record)) {
      return NextResponse.json({ status: "unchanged", uri });
    }

    await agent.api.com.atproto.repo.putRecord({
      repo: account.did,
      collection: "app.bsky.feed.generator",
      rkey: feed.slug,
      record
    });

    return NextResponse.json({ status: "published", uri });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
