import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { supa } from "./supa.js";

const PORT = Number(process.env.FEEDGEN_PORT ?? "8080");

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

function matchesKeyword(text: string, keyword: string) {
  const trimmed = keyword.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(`(^|\\W)${escapeRegExp(trimmed)}($|\\W)`, "i");
  return pattern.test(text);
}

function escapeFilterValue(value: string) {
  return value.replace(/[,()]/g, "\\$&");
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
    .single();
  if (error) throw error;
  if (!data?.is_enabled) return null;
  return data as { id: string; is_enabled: boolean };
}

async function getFeedRules(feedId: string) {
  const { data, error } = await supa
    .from("feed_rules")
    .select("include_keywords,exclude_keywords,lang")
    .eq("feed_id", feedId)
    .single();
  if (error) {
    return { include_keywords: [], exclude_keywords: [], lang: null as any };
  }
  return data as { include_keywords: string[]; exclude_keywords: string[]; lang: string | null };
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
    if (include.length && !include.some((k) => matchesKeyword(t, k))) return false;
    if (exclude.length && exclude.some((k) => matchesKeyword(t, k))) return false;
    return true;
  });

  return filtered as { uri: string; created_at: string; author_did: string; text: string }[];
}

const app = express();

app.get("/xrpc/app.bsky.feed.getFeedSkeleton", async (req: Request, res: Response) => {
  try {
    const parsed = qSchema.parse(req.query);
    const slug = parsed.feed;
    const limit = Math.min(Number(parsed.limit ?? "50"), 100);
    const cursor = parsed.cursor ? parseCursor(parsed.cursor) : null;

    const cfg = await getFeedConfig(slug);
    if (!cfg) return res.status(404).json({ error: "Feed not found" });

    const rules = await getFeedRules(cfg.id);
    const sources = await getFeedSources(cfg.id);
    const authorDids = sources
      .filter((s) => s.source_type === "account_list" && s.account_did)
      .map((s) => s.account_did!) as string[];

    const posts = await queryPosts({
      authorDids,
      include: rules.include_keywords ?? [],
      exclude: rules.exclude_keywords ?? [],
      lang: rules.lang,
      limit,
      cursor
    });

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
