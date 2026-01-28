import "dotenv/config";
import { BskyAgent } from "@atproto/api";
import { supa } from "./supa.js";

type FeedPostRecord = {
  $type?: string;
  text?: string;
  createdAt?: string;
  langs?: string[];
};

const DEFAULT_LIMIT = 100;

async function main() {
  const service = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
  const handle = process.env.BSKY_HANDLE;
  const appPassword = process.env.BSKY_APP_PASSWORD;
  const limit = Number(process.env.BSKY_BACKFILL_LIMIT ?? `${DEFAULT_LIMIT}`) || DEFAULT_LIMIT;

  if (!handle || !appPassword) {
    throw new Error("Missing BSKY_HANDLE or BSKY_APP_PASSWORD");
  }

  const agent = new BskyAgent({ service });
  const loginRes = await agent.login({ identifier: handle, password: appPassword });
  const did = loginRes.data.did;

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

  if (!rows.length) {
    process.stdout.write("No posts found to backfill.\n");
    return;
  }

  const { error } = await supa.from("indexed_posts").upsert(rows, { onConflict: "uri" });
  if (error) throw error;

  process.stdout.write(`Backfilled ${rows.length} posts into indexed_posts for ${did}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? String(err)}\n`);
  process.exit(1);
});
