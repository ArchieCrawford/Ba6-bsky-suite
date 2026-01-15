import "dotenv/config";
import { randomUUID } from "node:crypto";
import { supa } from "./supa.js";
import { agentFor } from "./bsky.js";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? "5000");
const LOCK_SECONDS = Number(process.env.WORKER_LOCK_SECONDS ?? "45");
const ERROR_BACKOFF_MS = Number(process.env.WORKER_ERROR_BACKOFF_MS ?? "2000");
const WORKER_ID = process.env.WORKER_ID ?? `worker-${randomUUID()}`;

type ScheduledRow = {
  id: string;
  user_id: string;
  account_did: string;
  draft_id: string;
  run_at: string;
  status: "queued" | "posting" | "posted" | "failed" | "canceled";
  attempt_count: number;
  max_attempts: number;
};

type DraftRow = { id: string; text: string };

type SessionRow = {
  user_id: string;
  account_did: string;
  access_jwt: string;
  refresh_jwt: string;
  expires_at: string;
};

type AccountRow = { user_id: string; did: string; handle: string; service: string };

type NormalizedError = {
  error_message: string;
  error_code?: string | number;
  stack?: string;
};

function log(level: "info" | "warn" | "error", message: string, meta: Record<string, unknown> = {}) {
  const payload = { ts: new Date().toISOString(), level, message, worker_id: WORKER_ID, ...meta };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function normalizeError(err: any): NormalizedError {
  return {
    error_message: err?.message ?? String(err),
    error_code: err?.code ?? err?.status,
    stack: typeof err?.stack === "string" ? err.stack.slice(0, 2000) : undefined
  };
}

async function claimDuePosts(limit = 10): Promise<ScheduledRow[]> {
  const claimed: ScheduledRow[] = [];
  while (claimed.length < limit) {
    const { data, error } = await supa.rpc("claim_next_scheduled_post", {
      lock_seconds: LOCK_SECONDS,
      worker_id: WORKER_ID
    });
    if (error) throw error;
    const rows = (data ?? []) as ScheduledRow[];
    if (rows.length === 0) break;
    claimed.push(rows[0]);
  }
  return claimed;
}

async function fetchDraft(userId: string, draftId: string): Promise<DraftRow> {
  const { data, error } = await supa
    .from("drafts")
    .select("id,text")
    .eq("id", draftId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data as DraftRow;
}

async function fetchAccount(userId: string, did: string): Promise<AccountRow> {
  const { data, error } = await supa
    .from("bsky_accounts")
    .select("user_id,did,handle,service")
    .eq("user_id", userId)
    .eq("did", did)
    .single();
  if (error) throw error;
  return data as AccountRow;
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

async function logEvent(
  userId: string,
  scheduledPostId: string | null,
  eventType: string,
  detail: Record<string, unknown> = {}
) {
  const { error } = await supa.from("post_events").insert({
    user_id: userId,
    scheduled_post_id: scheduledPostId,
    event_type: eventType,
    detail: { worker_id: WORKER_ID, ...detail }
  });
  if (error) {
    log("error", "post_event_insert_failed", {
      scheduled_post_id: scheduledPostId,
      event_type: eventType,
      error_message: error.message
    });
  }
}

async function markPosted(userId: string, scheduledPostId: string, uri: string, cid: string) {
  const now = new Date().toISOString();
  await supa
    .from("scheduled_posts")
    .update({
      status: "posted",
      posted_uri: uri,
      posted_cid: cid,
      last_error: null,
      locked_at: null,
      locked_by: null,
      updated_at: now
    })
    .eq("id", scheduledPostId)
    .eq("user_id", userId);
}

async function markFailed(
  userId: string,
  scheduledPostId: string,
  attemptCount: number,
  maxAttempts: number,
  err: string
) {
  const now = new Date().toISOString();
  const status = attemptCount + 1 >= maxAttempts ? "failed" : "queued";
  await supa
    .from("scheduled_posts")
    .update({
      status,
      attempt_count: attemptCount + 1,
      last_error: err,
      locked_at: null,
      locked_by: null,
      updated_at: now
    })
    .eq("id", scheduledPostId)
    .eq("user_id", userId);
}

async function postToBluesky(userId: string, did: string, text: string) {
  const account = await fetchAccount(userId, did);
  const session = await fetchSession(userId, did);

  const agent = agentFor(account.service);

  await agent.resumeSession({
    did,
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
    await saveSession(userId, did, newAccess, newRefresh, expiresAt);
    await agent.resumeSession({
      did,
      handle: refreshed.data.handle ?? account.handle,
      email: undefined,
      accessJwt: newAccess,
      refreshJwt: newRefresh,
      active: true
    });
  }

  const res = await agent.post({ text });
  return { uri: res.uri, cid: res.cid };
}

async function heartbeat(detail: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const { error } = await supa.from("worker_heartbeats").upsert(
    {
      worker_id: WORKER_ID,
      last_seen_at: now,
      detail: { pid: process.pid, poll_ms: POLL_MS, lock_seconds: LOCK_SECONDS, ...detail }
    },
    { onConflict: "worker_id" }
  );
  if (error) throw error;
}

async function loopOnce(): Promise<number> {
  const due = await claimDuePosts(10);
  for (const job of due) {
    const attempt = job.attempt_count + 1;
    const start = Date.now();
    let phase: "pre_post" | "posting" | "post_done" = "pre_post";
    try {
      await logEvent(job.user_id, job.id, "claimed", {
        run_at: job.run_at,
        attempt,
        lock_seconds: LOCK_SECONDS
      });
      const draft = await fetchDraft(job.user_id, job.draft_id);
      await logEvent(job.user_id, job.id, "post_attempt", { run_at: job.run_at, attempt });

      phase = "posting";
      const posted = await postToBluesky(job.user_id, job.account_did, draft.text);
      phase = "post_done";
      const durationMs = Date.now() - start;

      await supa.from("indexed_posts").upsert({
        uri: posted.uri,
        cid: posted.cid,
        author_did: job.account_did,
        text: draft.text,
        created_at: new Date().toISOString(),
        lang: null
      });

      await markPosted(job.user_id, job.id, posted.uri, posted.cid);
      await logEvent(job.user_id, job.id, "post_success", {
        uri: posted.uri,
        cid: posted.cid,
        duration_ms: durationMs,
        attempt
      });
      log("info", "post_success", {
        scheduled_post_id: job.id,
        duration_ms: durationMs,
        attempt,
        uri: posted.uri
      });
    } catch (e: any) {
      const durationMs = Date.now() - start;
      const norm = normalizeError(e);
      const msg = norm.error_message.slice(0, 1000);
      await markFailed(job.user_id, job.id, job.attempt_count, job.max_attempts, msg);
      const eventType = phase === "posting" ? "post_failed" : "worker_error";
      await logEvent(job.user_id, job.id, eventType, {
        duration_ms: durationMs,
        attempt,
        error_code: norm.error_code,
        error_message: msg,
        stack: norm.stack
      });
      log("error", eventType, {
        scheduled_post_id: job.id,
        duration_ms: durationMs,
        attempt,
        error_code: norm.error_code,
        error_message: msg
      });
    }
  }
  return due.length;
}

async function main() {
  log("info", "worker_start", { worker_id: WORKER_ID, poll_ms: POLL_MS, lock_seconds: LOCK_SECONDS });
  for (;;) {
    try {
      const claimedCount = await loopOnce();
      await heartbeat({ claimed_count: claimedCount });
      await new Promise((r) => setTimeout(r, POLL_MS));
    } catch (e: any) {
      const norm = normalizeError(e);
      log("error", "worker_loop_error", {
        error_code: norm.error_code,
        error_message: norm.error_message,
        stack: norm.stack
      });
      try {
        await heartbeat({ last_error: norm.error_message, error_code: norm.error_code });
      } catch (heartbeatError: any) {
        log("error", "heartbeat_failed", {
          error_message: heartbeatError?.message ?? String(heartbeatError)
        });
      }
      await new Promise((r) => setTimeout(r, ERROR_BACKOFF_MS));
    }
  }
}

main();
