import { BskyAgent } from "@atproto/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

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
  title: string | null;
  display_name: string | null;
  description: string | null;
};

type AccountRow = {
  id: string;
  user_id: string;
  account_did: string;
  handle: string | null;
  app_password: string | null;
  vault_secret_id: string | null;
  is_active: boolean | null;
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
  let query = supa
    .from("feeds")
    .select("id,user_id,slug,title,display_name,description")
    .eq("user_id", userId);
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
  let query = supa
    .from("accounts")
    .select("id,user_id,account_did,handle,app_password,vault_secret_id,is_active")
    .eq("user_id", userId);
  if (accountDid) query = query.eq("account_did", accountDid);
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

async function resolveAccountSecret(supa: SupabaseClientAny, account: AccountRow): Promise<string | null> {
  if (account.app_password) return account.app_password;
  if (!account.vault_secret_id) return null;
  const { data, error } = await supa.rpc("get_account_secret", { account_id: account.id });
  if (error) throw error;
  return data ?? null;
}

async function loginAgent(supa: SupabaseClientAny, account: AccountRow) {
  if (account.is_active === false) {
    throw new Error("Account is disabled");
  }
  const secret = await resolveAccountSecret(supa, account);
  if (!secret) {
    throw new Error("Missing app password for Bluesky account");
  }
  const service = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
  const agent = new BskyAgent({ service });
  const identifier = account.handle ?? account.account_did;
  const loginRes = await agent.login({ identifier, password: secret });

  if (loginRes.data.did && loginRes.data.did !== account.account_did) {
    throw new Error("Account DID mismatch");
  }

  const now = new Date().toISOString();
  await supa
    .from("accounts")
    .update({ last_auth_at: now, handle: loginRes.data.handle ?? account.handle })
    .eq("id", account.id);

  return agent;
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supa = createSupabaseServerClient(token);
    const feedgenDid = requireEnv("FEEDGEN_SERVICE_DID");

    const { data, error: authError } = await supa.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const input = (await request.json().catch(() => ({}))) as PublishRequest;
    const feed = await fetchFeed(supa, input, data.user.id);
    const account = await fetchAccount(supa, data.user.id, input.accountDid, input.handle);

    const { error: deleteExactError } = await supa
      .from("feed_sources")
      .delete()
      .eq("feed_id", feed.id)
      .eq("account_did", "did:plc:REPLACE_ME");
    if (deleteExactError) throw deleteExactError;

    const { error: deleteLikeError } = await supa
      .from("feed_sources")
      .delete()
      .eq("feed_id", feed.id)
      .ilike("account_did", "%REPLACE_ME%");
    if (deleteLikeError) throw deleteLikeError;

    const { data: sources, error: sourcesError } = await supa
      .from("feed_sources")
      .select("id,account_did")
      .eq("feed_id", feed.id)
      .eq("source_type", "account_list")
      .not("account_did", "is", null)
      .not("account_did", "ilike", "%REPLACE_ME%");
    if (sourcesError) throw sourcesError;

    if (!sources || sources.length === 0) {
      const payload = {
        feed_id: feed.id,
        source_type: "account_list",
        account_did: account.account_did
      };
      const { error: upsertError } = await supa
        .from("feed_sources")
        .upsert(payload, { onConflict: "feed_id,source_type,account_did" });
      if (upsertError) throw upsertError;
    }

    const agent = await loginAgent(supa, account);

    let existingRecord: any = null;
    try {
      const res = await agent.api.com.atproto.repo.getRecord({
        repo: account.account_did,
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
      displayName: feed.title ?? feed.display_name ?? feed.slug,
      ...(feed.description ? { description: feed.description } : {}),
      createdAt
    };

    const uri = `at://${account.account_did}/app.bsky.feed.generator/${feed.slug}`;
    if (recordsMatch(existingRecord, record)) {
      return NextResponse.json({ status: "unchanged", uri });
    }

    await agent.api.com.atproto.repo.putRecord({
      repo: account.account_did,
      collection: "app.bsky.feed.generator",
      rkey: feed.slug,
      record
    });

    return NextResponse.json({ status: "published", uri });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
