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

type HashtagGate = {
  feed_id: string;
  mode: "public" | "moderated";
  enrollment_tag: string;
  submission_tag?: string | null;
  require_mention: boolean;
  join_account?: string | null;
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

async function fetchHashtagGates() {
  const { data, error } = await supa
    .from("feed_gates")
    .select("feed_id,gate_type,mode,config,is_enabled")
    .eq("gate_type", "hashtag_opt_in")
    .eq("target_type", "feed")
    .eq("is_enabled", true);
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => {
      const config = row.config ?? {};
      return {
        feed_id: row.feed_id,
        mode: (row.mode ?? "public") as "public" | "moderated",
        enrollment_tag: normalizeTag(String(config.enrollment_tag ?? "")),
        submission_tag: typeof config.submission_tag === "string" ? normalizeTag(config.submission_tag) : null,
        require_mention: Boolean(config.require_mention),
        join_account: typeof config.join_account === "string" ? config.join_account : null
      } satisfies HashtagGate;
    })
    .filter((gate: HashtagGate) => gate.enrollment_tag);
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
  const joinHandleCache = new Map<string, string>();
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

  const resolveJoinHandle = async (joinAccount?: string | null) => {
    const normalized = joinAccount?.trim();
    if (normalized) {
      if (joinHandleCache.has(normalized)) return joinHandleCache.get(normalized) ?? null;
      if (!normalized.startsWith("did:")) {
        joinHandleCache.set(normalized, normalized);
        return normalized;
      }
      try {
        const profile = await agent.api.app.bsky.actor.getProfile({ actor: normalized });
        const handle = profile.data.handle ?? null;
        if (handle) joinHandleCache.set(normalized, handle);
        return handle;
      } catch (err: any) {
        log("warn", "indexer_join_handle_failed", {
          join_account: normalized,
          error_message: err?.message ?? String(err)
        });
        return null;
      }
    }
    if (joinHandle) return joinHandle;
    if (!joinDid) return null;
    try {
      const profile = await agent.api.app.bsky.actor.getProfile({ actor: joinDid });
      joinHandle = profile.data.handle ?? null;
    } catch (err: any) {
      log("warn", "indexer_join_handle_failed", { error_message: err?.message ?? String(err) });
    }
    return joinHandle;
  };

  const runOptInScan = async () => {
    const gates = await fetchHashtagGates();
    if (!gates.length) return;

    const seen = new Set<string>();

    for (const gate of gates) {
      const handle = gate.require_mention ? await resolveJoinHandle(gate.join_account) : null;
      if (gate.require_mention && !handle) continue;

      const query = gate.require_mention ? `@${handle} #${gate.enrollment_tag}` : `#${gate.enrollment_tag}`;
      const response = await agent.api.app.bsky.feed.searchPosts({ q: query, limit: opts.limit });
      const posts = response.data.posts ?? [];

      for (const post of posts) {
        const record = post.record as SearchPostRecord | undefined;
        const text = typeof record?.text === "string" ? record.text : "";
        const tags = extractTags(text);
        if (!tags.length || !tags.includes(gate.enrollment_tag)) continue;
        const authorDid = post.author?.did;
        if (!authorDid) continue;

        const key = `${gate.feed_id}:${authorDid}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!canEnroll(gate.feed_id)) {
          log("warn", "indexer_opt_in_rate_limited", { feed_id: gate.feed_id, author_did: authorDid });
          continue;
        }

        if (gate.mode === "moderated") {
          const { error: insertError } = await supa.from("feed_join_requests").insert({
            feed_id: gate.feed_id,
            requester_did: authorDid,
            status: "pending"
          });
          if (insertError && String(insertError.code) !== "23505") {
            log("error", "indexer_opt_in_request_failed", {
              feed_id: gate.feed_id,
              author_did: authorDid,
              error_message: insertError.message
            });
          } else {
            recordEnrollment(gate.feed_id);
            log("info", "indexer_opt_in_requested", { feed_id: gate.feed_id, author_did: authorDid });
          }
          continue;
        }

        const { error: insertError } = await supa.from("feed_sources").insert({
          feed_id: gate.feed_id,
          source_type: "account_list",
          account_did: authorDid
        });
        if (insertError && String(insertError.code) !== "23505") {
          log("error", "indexer_opt_in_failed", {
            feed_id: gate.feed_id,
            author_did: authorDid,
            error_message: insertError.message
          });
        } else {
          recordEnrollment(gate.feed_id);
          log("info", "indexer_opt_in_enrolled", { feed_id: gate.feed_id, author_did: authorDid });
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
