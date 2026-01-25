import "dotenv/config";
import { agentFor } from "./bsky.js";
import { supa } from "./supa.js";

type PublishArgs = {
  slug?: string;
  userId?: string;
  accountDid?: string;
  handle?: string;
  feedgenDid?: string;
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

function parseArgs(argv: string[]): PublishArgs {
  const args: PublishArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key?.startsWith("--")) continue;
    switch (key) {
      case "--slug":
        args.slug = val;
        i += 1;
        break;
      case "--user":
      case "--user-id":
        args.userId = val;
        i += 1;
        break;
      case "--account-did":
        args.accountDid = val;
        i += 1;
        break;
      case "--handle":
        args.handle = val;
        i += 1;
        break;
      case "--feedgen-did":
        args.feedgenDid = val;
        i += 1;
        break;
      case "--help":
        printUsage();
        process.exit(0);
      default:
        break;
    }
  }
  return args;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  npm run publish-feed -- --slug <slug> [--user <uuid>] [--account-did <did>] [--handle <handle>] [--feedgen-did <did>]",
      "",
      "Defaults:",
      "  --user uses BSKY_USER_ID",
      "  --feedgen-did uses FEEDGEN_SERVICE_DID",
      ""
    ].join("\n")
  );
}

async function fetchFeed(slug: string, userId?: string): Promise<FeedRow> {
  let query = supa.from("feeds").select("id,user_id,slug,display_name,description").eq("slug", slug);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Feed not found for slug");
  }
  if (data.length > 1) {
    throw new Error("Multiple feeds match slug; provide --user-id");
  }
  return data[0] as FeedRow;
}

async function fetchAccount(userId: string, accountDid?: string, handle?: string): Promise<AccountRow> {
  let query = supa.from("bsky_accounts").select("user_id,did,handle,service").eq("user_id", userId);
  if (accountDid) query = query.eq("did", accountDid);
  if (handle) query = query.eq("handle", handle);
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No Bluesky account found for user");
  }
  if (data.length > 1) {
    throw new Error("Multiple Bluesky accounts found; provide --account-did or --handle");
  }
  return data[0] as AccountRow;
}

async function fetchSession(userId: string, did: string): Promise<SessionRow> {
  const { data, error } = await supa
    .from("bsky_sessions")
    .select("user_id,account_did,access_jwt,refresh_jwt,expires_at")
    .eq("user_id", userId)
    .eq("account_did", did)
    .single();
  if (error) throw error;
  return data as SessionRow;
}

async function saveSession(userId: string, did: string, accessJwt: string, refreshJwt: string, expiresAt: Date) {
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

async function resumeAgentSession(account: AccountRow, session: SessionRow) {
  const agent = agentFor(account.service);
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
    await saveSession(account.user_id, account.did, newAccess, newRefresh, expiresAt);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  if (!slug) {
    printUsage();
    process.exit(1);
  }

  const feedgenDid = args.feedgenDid ?? process.env.FEEDGEN_SERVICE_DID;
  if (!feedgenDid) {
    throw new Error("Missing env: FEEDGEN_SERVICE_DID");
  }

  const userId = args.userId ?? process.env.BSKY_USER_ID;
  const feed = await fetchFeed(slug, userId);
  const account = await fetchAccount(feed.user_id, args.accountDid, args.handle);
  const session = await fetchSession(feed.user_id, account.did);
  const agent = await resumeAgentSession(account, session);

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

  if (recordsMatch(existingRecord, record)) {
    process.stdout.write(`Feed already published: at://${account.did}/app.bsky.feed.generator/${feed.slug}\n`);
    return;
  }

  await agent.api.com.atproto.repo.putRecord({
    repo: account.did,
    collection: "app.bsky.feed.generator",
    rkey: feed.slug,
    record
  });

  process.stdout.write(`Published feed: at://${account.did}/app.bsky.feed.generator/${feed.slug}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? String(err)}\n`);
  process.exit(1);
});
