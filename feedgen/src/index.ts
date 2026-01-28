import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { supa } from "./supa.js";

const PORT = Number(process.env.PORT ?? process.env.FEEDGEN_PORT ?? "8080");

const qSchema = z.object({
  feed: z.string().min(1),
  limit: z.string().optional(),
  cursor: z.string().optional()
});

const cursorSchema = z.object({
  created_at: z.string().datetime(),
  uri: z.string().min(1)
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeyword(text: string, keyword: string, caseInsensitive = true) {
  const trimmed = keyword.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(`(^|\\W)${escapeRegExp(trimmed)}($|\\W)`, caseInsensitive ? "i" : undefined);
  return pattern.test(text);
}

function matchesTag(text: string, tag: string, caseInsensitive = true) {
  const trimmed = tag.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(`(^|\\W)#?${escapeRegExp(trimmed)}($|\\W)`, caseInsensitive ? "i" : undefined);
  return pattern.test(text);
}

function escapeFilterValue(value: string) {
  return value.replace(/[,()]/g, "\\$&");
}

function normalizeFeedSlug(feed: string) {
  if (!feed) return null;
  const generatorPattern = /^at:\/\/[^/]+\/app\.bsky\.feed\.generator\/([^/?#]+)/i;
  if (feed.startsWith("at://")) {
    const match = feed.match(generatorPattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
    const parts = feed.split("/");
    return parts[parts.length - 1] ? decodeURIComponent(parts[parts.length - 1]) : null;
  }
  return feed;
}

function parseCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return cursorSchema.parse(parsed);
  } catch {
    throw new Error("Invalid cursor");
  }
}

function makeCursor(createdAt: string, uri: string) {
  const payload = JSON.stringify({ created_at: createdAt, uri });
  return Buffer.from(payload).toString("base64url");
}

async function getFeedConfig(slug: string) {
  const { data, error } = await supa
    .from("feeds")
    .select("id,is_enabled")
    .eq("slug", slug)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_enabled) return null;
  return data as { id: string; is_enabled: boolean };
}

async function getFeedRules(feedId: string) {
  const { data, error } = await supa
    .from("feed_rules")
    .select(
      "include_keywords,exclude_keywords,lang,include_mode,case_insensitive,submit_enabled,submit_tag"
    )
    .eq("feed_id", feedId)
    .single();
  if (error) {
    return {
      include_keywords: [],
      exclude_keywords: [],
      lang: null as any,
      include_mode: "any",
      case_insensitive: true,
      submit_enabled: false,
      submit_tag: null as any
    };
  }
  return data as {
    include_keywords: string[];
    exclude_keywords: string[];
    lang: string | null;
    include_mode: string | null;
    case_insensitive: boolean | null;
    submit_enabled: boolean | null;
    submit_tag: string | null;
  };
}

async function getFeedSources(feedId: string) {
  const { data, error } = await supa
    .from("feed_sources")
    .select("source_type,account_did")
    .eq("feed_id", feedId);
  if (error) throw error;
  return (data ?? []) as { source_type: string; account_did: string | null }[];
}

async function queryPosts(params: {
  authorDids: string[];
  include: string[];
  exclude: string[];
  includeMode: "any" | "all";
  caseInsensitive: boolean;
  lang?: string | null;
  limit: number;
  cursor?: { created_at: string; uri: string } | null;
}) {
  let q = supa
    .from("indexed_posts")
    .select("uri,created_at,text,author_did")
    .order("created_at", { ascending: false })
    .order("uri", { ascending: false })
    .limit(params.limit);

  if (params.authorDids.length > 0) q = q.in("author_did", params.authorDids);
  if (params.lang) q = q.eq("lang", params.lang);

  if (params.cursor) {
    const { created_at, uri } = params.cursor;
    const safeUri = escapeFilterValue(uri);
    q = q.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},uri.lt.${safeUri})`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const include = params.include.map((s) => s.trim()).filter(Boolean);
  const exclude = params.exclude.map((s) => s.trim()).filter(Boolean);

  const filtered = (data ?? []).filter((row: any) => {
    const t = String(row.text ?? "");
    const matchedInclude = include.filter((k) => matchesKeyword(t, k, params.caseInsensitive));
    const matchedExclude = exclude.filter((k) => matchesKeyword(t, k, params.caseInsensitive));
    const passesInclude =
      include.length === 0 ||
      (params.includeMode === "all" ? matchedInclude.length === include.length : matchedInclude.length > 0);
    const passesExclude = matchedExclude.length === 0;
    if (!passesInclude || !passesExclude) return false;
    return true;
  });

  return filtered as { uri: string; created_at: string; author_did: string; text: string }[];
}

async function querySubmitPosts(params: {
  tag: string;
  exclude: string[];
  caseInsensitive: boolean;
  lang?: string | null;
  limit: number;
  cursor?: { created_at: string; uri: string } | null;
}) {
  let q = supa
    .from("indexed_posts")
    .select("uri,created_at,text,author_did")
    .order("created_at", { ascending: false })
    .order("uri", { ascending: false })
    .limit(params.limit);

  if (params.lang) q = q.eq("lang", params.lang);

  const tagFilter = `%${params.tag}%`;
  q = params.caseInsensitive ? q.ilike("text", tagFilter) : q.like("text", tagFilter);

  if (params.cursor) {
    const { created_at, uri } = params.cursor;
    const safeUri = escapeFilterValue(uri);
    q = q.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},uri.lt.${safeUri})`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const exclude = params.exclude.map((s) => s.trim()).filter(Boolean);
  const filtered = (data ?? []).filter((row: any) => {
    const t = String(row.text ?? "");
    if (!matchesTag(t, params.tag, params.caseInsensitive)) return false;
    if (exclude.length && exclude.some((k) => matchesKeyword(t, k, params.caseInsensitive))) return false;
    return true;
  });

  return filtered as { uri: string; created_at: string; author_did: string; text: string }[];
}

const app = express();
const PUBLIC_PATHS = new Set(["/healthz", "/__version", "/.well-known/did.json"]);

app.use((req: Request, res: Response, next) => {
  if (PUBLIC_PATHS.has(req.path)) {
    res.on("finish", () => {
      const host = req.headers["host"] ?? "";
      const forwardedProto = req.headers["x-forwarded-proto"] ?? "";
      const forwardedFor = req.headers["x-forwarded-for"] ?? "";
      process.stdout.write(
        JSON.stringify({
          level: "info",
          event: "public_route",
          method: req.method,
          path: req.path,
          status: res.statusCode,
          host,
          forwarded_proto: forwardedProto,
          forwarded_for: forwardedFor
        }) + "\n"
      );
    });
  }
  next();
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).type("text/plain").send("ok");
});

app.get("/__version", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    ts: new Date().toISOString()
  });
});

app.get("/.well-known/did.json", (_req: Request, res: Response) => {
  res.status(200).json({
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: "did:web:feeds.ba6-bsky-suite.com",
    service: [
      {
        id: "#bsky_fg",
        type: "BskyFeedGenerator",
        serviceEndpoint: "https://feeds.ba6-bsky-suite.com"
      }
    ]
  });
});

app.get("/xrpc/app.bsky.feed.getFeedSkeleton", async (req: Request, res: Response) => {
  try {
    const parsed = qSchema.parse(req.query);
    const feedParam = parsed.feed;
    const slug = normalizeFeedSlug(feedParam);
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
      return res.status(400).json({ error: "Invalid feed slug" });
    }
    const limit = Math.min(Number(parsed.limit ?? "50"), 100);
    const cursor = parsed.cursor ? parseCursor(parsed.cursor) : null;

    const cfg = await getFeedConfig(slug);
    if (!cfg) return res.status(404).json({ error: "Feed not found" });

    const rules = await getFeedRules(cfg.id);
    const sources = await getFeedSources(cfg.id);
    const authorDids = sources
      .filter((s) => s.source_type === "account_list" && s.account_did)
      .map((s) => String(s.account_did ?? "").trim())
      .filter((did) => did && did.startsWith("did:") && did.length > 5)
      .filter((did) => !did.toUpperCase().includes("REPLACE_ME"));

    const includeMode = (rules.include_mode ?? "any") as "any" | "all";
    const caseInsensitive = rules.case_insensitive ?? true;

    let posts: { uri: string; created_at: string; author_did: string; text: string }[] = [];

    if (authorDids.length > 0) {
      posts = await queryPosts({
        authorDids,
        include: rules.include_keywords ?? [],
        exclude: rules.exclude_keywords ?? [],
        includeMode,
        caseInsensitive,
        lang: rules.lang,
        limit,
        cursor
      });
    }

    if (rules.submit_enabled && rules.submit_tag) {
      const submitPosts = await querySubmitPosts({
        tag: rules.submit_tag,
        exclude: rules.exclude_keywords ?? [],
        caseInsensitive,
        lang: rules.lang,
        limit,
        cursor
      });

      const merged = new Map<string, { uri: string; created_at: string; author_did: string; text: string }>();
      for (const row of [...posts, ...submitPosts]) {
        if (!merged.has(row.uri)) merged.set(row.uri, row);
      }
      posts = Array.from(merged.values()).sort((a, b) => {
        if (a.created_at === b.created_at) return b.uri.localeCompare(a.uri);
        return b.created_at.localeCompare(a.created_at);
      });
    }

    if (posts.length === 0) {
      return res.json({ feed: [], cursor: undefined });
    }

    const skeleton = posts.map((p) => ({ post: p.uri }));
    const nextCursor = posts.length
      ? makeCursor(posts[posts.length - 1].created_at, posts[posts.length - 1].uri)
      : undefined;

    res.json({ feed: skeleton, cursor: nextCursor });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? String(e) });
  }
});

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.listen(PORT, () => {
  process.stdout.write(`feedgen listening on ${PORT}\n`);
});
