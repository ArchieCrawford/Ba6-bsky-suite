import { supa } from "./supa.js";
import { agentFor } from "./bsky.js";

type Logger = (level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => void;

type IndexerOptions = {
  enabled: boolean;
  intervalMs: number;
  limit: number;
  cooldownMs: number;
  service: string;
  maxDidsPerTick: number;
  jitterMs: number;
};

type FeedPostRecord = {
  text?: string;
  createdAt?: string;
  langs?: string[];
};

type SearchPostRecord = {
  text?: string;
};

type OptInRule = {
  feed_id: string;
  opt_in_tag: string;
  opt_in_mode: "public" | "moderated";
  source_strategy: "curated" | "opt_in";
};

const DEFAULT_INTERVAL_MS = 120000;
const OPT_IN_MAX_PER_HOUR = 20;

function parseBool(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return !["0", "false", "no"].includes(value.toLowerCase());
}

function getOptions(): IndexerOptions {
  const enabled = parseBool(process.env.INDEXER_ENABLED, true);
  const intervalMs = Number(process.env.INDEXER_INTERVAL_MS ?? `${DEFAULT_INTERVAL_MS}`) || DEFAULT_INTERVAL_MS;
  const limit = Number(process.env.INDEXER_LIMIT ?? "50") || 50;
  const cooldownMs = Number(process.env.INDEXER_COOLDOWN_MS ?? `${intervalMs}`) || intervalMs;
  const maxDidsPerTick = Number(process.env.INDEXER_MAX_DIDS_PER_TICK ?? "25") || 25;
  const jitterMs = Number(process.env.INDEXER_JITTER_MS ?? "5000") || 5000;
  const service = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
  return { enabled, intervalMs, limit, cooldownMs, service, maxDidsPerTick, jitterMs };
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/^#+/, "").toLowerCase();
}

function extractTags(text: string) {
  const matches = text.match(/#[\\w-]+/g) ?? [];
  return matches.map((tag) => normalizeTag(tag));
}

async function fetchSourceDids() {
  const { data, error } = await supa
    .from("feed_sources")
    .select("account_did")
    .eq("source_type", "account_list")
    .not("account_did", "is", null)
    .not("account_did", "ilike", "%REPLACE_ME%");
  if (error) throw error;
  const raw = (data ?? [])
    .map((row: any) => String(row.account_did ?? "").trim())
    .filter((did) => did && !did.toUpperCase().includes("REPLACE_ME"));
  return Array.from(new Set(raw));
}

async function fetchOptInRules() {
  const { data, error } = await supa
    .from("feed_rules")
    .select("feed_id,opt_in_tag,opt_in_mode,opt_in_enabled,source_strategy")
    .eq("opt_in_enabled", true)
    .not("opt_in_tag", "is", null);
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => ({
      feed_id: row.feed_id,
      opt_in_tag: normalizeTag(String(row.opt_in_tag ?? "")),
      opt_in_mode: (row.opt_in_mode ?? "public") as "public" | "moderated",
      source_strategy: (row.source_strategy ?? "curated") as "curated" | "opt_in"
    }))
    .filter((row: OptInRule) => row.opt_in_tag && row.source_strategy === "opt_in");
}

async function indexDid(agent: ReturnType<typeof agentFor>, did: string, limit: number) {
  const res = await agent.api.app.bsky.feed.getAuthorFeed({ actor: did, limit });
  const items = res.data.feed ?? [];

  const rows = items
    .map((it) => it.post)
    .filter(Boolean)
    .map((post) => {
      const record = post.record as FeedPostRecord | undefined;
      const text = typeof record?.text === "string" ? record.text : "";
      const createdAt = typeof record?.createdAt === "string" ? record.createdAt : new Date().toISOString();
      const lang = Array.isArray(record?.langs) ? record?.langs[0] ?? null : null;
      return {
        uri: post.uri,
        author_did: post.author?.did ?? did,
        text,
        created_at: createdAt,
        lang
      };
    });

  if (!rows.length) return 0;

  const { error } = await supa.from("indexed_posts").upsert(rows, { onConflict: "uri" });
  if (error) throw error;
  return rows.length;
}

export function startIndexer(log: Logger) {
  const opts = getOptions();
  if (!opts.enabled) {
    log("info", "indexer_disabled");
    return;
  }

  const agent = agentFor(opts.service);
  const lastRun = new Map<string, number>();
  let running = false;
  let firstRun = true;
  let joinHandle: string | null = process.env.JOIN_ACCOUNT_HANDLE?.trim() || null;
  const joinDid = process.env.JOIN_ACCOUNT_DID?.trim() || null;
  const enrollmentState = new Map<string, { windowStart: number; count: number }>();

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const shuffle = <T,>(arr: T[]) => {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const canEnroll = (feedId: string) => {
    const now = Date.now();
    const entry = enrollmentState.get(feedId);
    if (!entry || now - entry.windowStart > 60 * 60 * 1000) {
      enrollmentState.set(feedId, { windowStart: now, count: 0 });
      return true;
    }
    return entry.count < OPT_IN_MAX_PER_HOUR;
  };

  const recordEnrollment = (feedId: string) => {
    const now = Date.now();
    const entry = enrollmentState.get(feedId);
    if (!entry || now - entry.windowStart > 60 * 60 * 1000) {
      enrollmentState.set(feedId, { windowStart: now, count: 1 });
    } else {
      entry.count += 1;
      enrollmentState.set(feedId, entry);
    }
  };

  const resolveJoinHandle = async () => {
    if (joinHandle || !joinDid) return joinHandle;
    try {
      const profile = await agent.api.app.bsky.actor.getProfile({ actor: joinDid });
      joinHandle = profile.data.handle ?? null;
    } catch (err: any) {
      log("warn", "indexer_join_handle_failed", { error_message: err?.message ?? String(err) });
    }
    return joinHandle;
  };

  const runOptInScan = async () => {
    if (!joinDid) return;
    const rules = await fetchOptInRules();
    if (!rules.length) return;
    const handle = await resolveJoinHandle();
    if (!handle) return;

    const response = await agent.api.app.bsky.feed.searchPosts({ q: `@${handle}`, limit: opts.limit });
    const posts = response.data.posts ?? [];
    const tagMap = new Map<string, OptInRule[]>();
    for (const rule of rules) {
      const key = normalizeTag(rule.opt_in_tag);
      if (!tagMap.has(key)) tagMap.set(key, []);
      tagMap.get(key)?.push(rule);
    }

    const seen = new Set<string>();
    for (const post of posts) {
      const record = post.record as SearchPostRecord | undefined;
      const text = typeof record?.text === "string" ? record.text : "";
      const tags = extractTags(text);
      if (!tags.length) continue;
      const authorDid = post.author?.did;
      if (!authorDid) continue;
      for (const tag of tags) {
        const rulesForTag = tagMap.get(tag);
        if (!rulesForTag) continue;
        for (const rule of rulesForTag) {
          const key = `${rule.feed_id}:${authorDid}`;
          if (seen.has(key)) continue;
          seen.add(key);

          if (!canEnroll(rule.feed_id)) {
            log("warn", "indexer_opt_in_rate_limited", { feed_id: rule.feed_id, author_did: authorDid });
            continue;
          }

          if (rule.opt_in_mode === "moderated") {
            const { error: insertError } = await supa.from("feed_join_requests").insert({
              feed_id: rule.feed_id,
              account_did: authorDid,
              status: "pending"
            });
            if (insertError && String(insertError.code) !== "23505") {
              log("error", "indexer_opt_in_request_failed", {
                feed_id: rule.feed_id,
                author_did: authorDid,
                error_message: insertError.message
              });
            } else {
              recordEnrollment(rule.feed_id);
              log("info", "indexer_opt_in_requested", { feed_id: rule.feed_id, author_did: authorDid });
            }
            continue;
          }

          const { error: insertError } = await supa.from("feed_sources").insert({
            feed_id: rule.feed_id,
            source_type: "account_list",
            account_did: authorDid
          });
          if (insertError && String(insertError.code) !== "23505") {
            log("error", "indexer_opt_in_failed", {
              feed_id: rule.feed_id,
              author_did: authorDid,
              error_message: insertError.message
            });
          } else {
            recordEnrollment(rule.feed_id);
            log("info", "indexer_opt_in_enrolled", { feed_id: rule.feed_id, author_did: authorDid });
          }
        }
      }
    }
  };

  const runOnce = async () => {
    if (running) return;
    running = true;
    try {
      if (firstRun && opts.jitterMs > 0) {
        await sleep(Math.floor(Math.random() * opts.jitterMs));
      }
      firstRun = false;

      const dids = await fetchSourceDids();
      const now = Date.now();
      const candidates = shuffle(dids).slice(0, opts.maxDidsPerTick);
      for (const did of candidates) {
        const last = lastRun.get(did);
        if (last && now - last < opts.cooldownMs) continue;
        try {
          const count = await indexDid(agent, did, opts.limit);
          lastRun.set(did, Date.now());
          log("info", "indexer_did", { did, count });
        } catch (err: any) {
          log("error", "indexer_did_failed", { did, error_message: err?.message ?? String(err) });
        }
        await sleep(250 + Math.floor(Math.random() * 500));
      }

      await runOptInScan();
    } catch (err: any) {
      log("error", "indexer_failed", { error_message: err?.message ?? String(err) });
    } finally {
      running = false;
    }
  };

  log("info", "indexer_start", {
    interval_ms: opts.intervalMs,
    limit: opts.limit,
    cooldown_ms: opts.cooldownMs,
    max_dids_per_tick: opts.maxDidsPerTick,
    jitter_ms: opts.jitterMs
  });

  runOnce();
  setInterval(runOnce, opts.intervalMs);
}
