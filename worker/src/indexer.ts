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

const DEFAULT_INTERVAL_MS = 120000;

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
        lang,
        raw: { cid: post.cid, source: "indexer" }
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

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const shuffle = <T,>(arr: T[]) => {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
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
