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
  title: string | null;
  description: string | null;
};

type AccountRow = {
  id: string;
  user_id: string;
  account_did: string;
  handle: string | null;
  app_password: string | null;
  is_active: boolean | null;
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
  let query = supa.from("feeds").select("id,user_id,slug,title,description").eq("slug", slug);
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
  let query = supa
    .from("accounts")
    .select("id,user_id,account_did,handle,app_password,is_active")
    .eq("user_id", userId);
  if (accountDid) query = query.eq("account_did", accountDid);
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

async function loginAgent(account: AccountRow) {
  if (account.is_active === false) {
    throw new Error("Account is disabled");
  }
  if (!account.app_password) {
    throw new Error("Missing app password for Bluesky account");
  }
  const service = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
  const agent = agentFor(service);
  const identifier = account.handle ?? account.account_did;
  const loginRes = await agent.login({ identifier, password: account.app_password });

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
  const agent = await loginAgent(account);

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
    displayName: feed.title ?? feed.slug,
    ...(feed.description ? { description: feed.description } : {}),
    createdAt
  };

  if (recordsMatch(existingRecord, record)) {
    process.stdout.write(`Feed already published: at://${account.account_did}/app.bsky.feed.generator/${feed.slug}\n`);
    return;
  }

  await agent.api.com.atproto.repo.putRecord({
    repo: account.account_did,
    collection: "app.bsky.feed.generator",
    rkey: feed.slug,
    record
  });

  process.stdout.write(`Published feed: at://${account.account_did}/app.bsky.feed.generator/${feed.slug}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? String(err)}\n`);
  process.exit(1);
});
