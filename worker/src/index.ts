import "dotenv/config";
import { randomUUID } from "node:crypto";
import { supa } from "./supa.js";
import { agentFor } from "./bsky.js";
import { processAiImageJobs } from "./aiImages.js";
import { startIndexer } from "./indexer.js";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? "5000");
const LOCK_SECONDS = Number(process.env.WORKER_LOCK_SECONDS ?? "45");
const ERROR_BACKOFF_MS = Number(process.env.WORKER_ERROR_BACKOFF_MS ?? "2000");
const WORKER_ID = process.env.WORKER_ID ?? `worker-${randomUUID()}`;
const AI_LOCK_SECONDS = Number(process.env.AI_LOCK_SECONDS ?? "60");
const AI_BATCH = Number(process.env.AI_JOB_BATCH ?? "2");

type ScheduledRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  account_did: string | null;
  draft_id: string;
  run_at: string;
  status: "queued" | "posting" | "posted" | "failed" | "canceled";
  attempt_count: number;
  max_attempts: number;
};

type DraftRow = { id: string; text: string };

type AccountRow = {
  id: string;
  user_id: string;
  account_did: string;
  handle: string | null;
  app_password: string | null;
  vault_secret_id: string | null;
  is_active: boolean | null;
};

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

async function fetchAccount(accountId: string, expectedDid: string): Promise<AccountRow> {
  const { data, error } = await supa
    .from("accounts")
    .select("id,user_id,account_did,handle,app_password,vault_secret_id,is_active")
    .eq("id", accountId)
    .single();
  if (error) throw error;
  const account = data as AccountRow;
  if (account.account_did !== expectedDid) {
    throw new Error("Account DID mismatch");
  }
  return account;
}

async function fetchAccountSecret(account: AccountRow): Promise<string> {
  if (account.app_password) return account.app_password;
  if (!account.vault_secret_id) {
    throw new Error("Missing app password for account");
  }
  const { data, error } = await supa.rpc("get_account_secret", { account_id: account.id });
  if (error) throw error;
  if (!data) {
    throw new Error("Vault secret not found");
  }
  return String(data);
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

async function markPosted(scheduledPostId: string, uri: string, cid: string) {
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
    .eq("id", scheduledPostId);
}

async function markMissingAccount(scheduledPostId: string, maxAttempts: number) {
  const now = new Date().toISOString();
  await supa
    .from("scheduled_posts")
    .update({
      status: "failed",
      attempt_count: maxAttempts,
      last_error: "No connected Bluesky account",
      locked_at: null,
      locked_by: null,
      updated_at: now
    })
    .eq("id", scheduledPostId);
}

async function markFailed(
  scheduledPostId: string,
  attemptCount: number,
  maxAttempts: number,
  err: string
) {
  const now = new Date().toISOString();
  const status = attemptCount >= maxAttempts ? "failed" : "queued";
  await supa
    .from("scheduled_posts")
    .update({
      status,
      attempt_count: attemptCount,
      last_error: err,
      locked_at: null,
      locked_by: null,
      updated_at: now
    })
    .eq("id", scheduledPostId);
}

async function loginAgent(account: AccountRow) {
  if (account.is_active === false) {
    throw new Error("Account is disabled");
  }
  const secret = await fetchAccountSecret(account);
  const service = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
  const agent = agentFor(service);
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

async function postToBluesky(account: AccountRow, text: string) {
  const agent = await loginAgent(account);
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

async function loopOnce(): Promise<{ scheduled: number; ai: number }> {
  const due = await claimDuePosts(10);
  for (const job of due) {
    const attempt = job.attempt_count;
    const start = Date.now();
    let phase: "pre_post" | "posting" | "post_done" = "pre_post";
    try {
      await logEvent(job.user_id, job.id, "claimed", {
        run_at: job.run_at,
        attempt,
        lock_seconds: LOCK_SECONDS
      });
      if (!job.account_id || !job.account_did) {
        await logEvent(job.user_id, job.id, "missing_account", {
          run_at: job.run_at,
          attempt,
          error_message: "No connected Bluesky account"
        });
        await markMissingAccount(job.id, job.max_attempts);
        log("warn", "missing_account", { scheduled_post_id: job.id });
        continue;
      }

      const draft = await fetchDraft(job.user_id, job.draft_id);
      const account = await fetchAccount(job.account_id, job.account_did);
      await logEvent(job.user_id, job.id, "post_attempt", { run_at: job.run_at, attempt });

      phase = "posting";
      const posted = await postToBluesky(account, draft.text);
      phase = "post_done";
      const durationMs = Date.now() - start;

      await supa.from("indexed_posts").upsert({
        uri: posted.uri,
        author_did: job.account_did,
        text: draft.text,
        created_at: new Date().toISOString(),
        lang: null
      });

      await markPosted(job.id, posted.uri, posted.cid);
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
      await markFailed(job.id, job.attempt_count, job.max_attempts, msg);
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
  const aiProcessed = await processAiImageJobs({
    workerId: WORKER_ID,
    lockSeconds: AI_LOCK_SECONDS,
    batchSize: AI_BATCH,
    log
  });
  return { scheduled: due.length, ai: aiProcessed };
}

async function main() {
  log("info", "worker_start", { worker_id: WORKER_ID, poll_ms: POLL_MS, lock_seconds: LOCK_SECONDS });
  startIndexer(log);
  for (;;) {
    try {
      const counts = await loopOnce();
      await heartbeat({ claimed_count: counts.scheduled, ai_claimed_count: counts.ai });
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
