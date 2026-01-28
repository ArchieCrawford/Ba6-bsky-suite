import { randomUUID } from "node:crypto";
import { supa } from "./supa.js";

const VENICE_API_URL = process.env.VENICE_API_URL ?? "https://api.venice.ai/api/v1/image/generate";
const VENICE_API_KEY = process.env.VENICE_API_KEY;

type AiJob = {
  id: string;
  user_id: string;
  model: string;
  prompt: string;
  negative_prompt: string | null;
  params: Record<string, unknown> | null;
  attempt_count: number;
  max_attempts: number;
};

type ImageResult = {
  buffer: Buffer;
  mime: string;
  width?: number;
  height?: number;
  requestId?: string;
};

type Logger = (level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => void;

function parseSize(size: string | undefined) {
  if (!size) return {};
  const match = size.match(/^(\d{2,4})x(\d{2,4})$/i);
  if (!match) return {};
  return { width: Number(match[1]), height: Number(match[2]) };
}

function extensionForMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "bin";
}

function extractImagePayload(payload: any) {
  if (!payload) return {};
  const requestId =
    payload.request_id ??
    payload.id ??
    payload?.data?.request_id ??
    payload?.data?.[0]?.request_id ??
    payload?.meta?.request_id;

  const base64 =
    payload?.data?.[0]?.b64_json ??
    payload?.data?.[0]?.base64 ??
    payload?.data?.[0]?.image ??
    payload?.images?.[0]?.base64 ??
    payload?.images?.[0] ??
    payload?.image ??
    null;

  const url =
    payload?.data?.[0]?.url ??
    payload?.images?.[0]?.url ??
    payload?.url ??
    null;

  const mime = payload?.mime_type ?? payload?.data?.[0]?.mime_type ?? payload?.data?.[0]?.content_type;

  const width = payload?.width ?? payload?.data?.[0]?.width;
  const height = payload?.height ?? payload?.data?.[0]?.height;

  return { base64, url, mime, width, height, requestId };
}

function decodeBase64(base64: string, mimeHint?: string) {
  let mime = mimeHint ?? "image/webp";
  let raw = base64;
  const match = base64.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    mime = match[1];
    raw = match[2];
  }
  return { buffer: Buffer.from(raw, "base64"), mime };
}

async function fetchImage(job: AiJob): Promise<ImageResult> {
  if (!VENICE_API_KEY) {
    throw new Error("Missing VENICE_API_KEY");
  }
  const params = (job.params ?? {}) as Record<string, unknown>;
  const { size, width: paramWidth, height: paramHeight, label, ...rest } = params as Record<string, any>;
  let width = typeof paramWidth === "number" ? paramWidth : undefined;
  let height = typeof paramHeight === "number" ? paramHeight : undefined;
  if (!width || !height) {
    const parsed = parseSize(typeof size === "string" ? size : undefined);
    width = width ?? parsed.width;
    height = height ?? parsed.height;
  }

  const payload = {
    model: job.model,
    prompt: job.prompt,
    ...(job.negative_prompt ? { negative_prompt: job.negative_prompt } : {}),
    ...rest,
    ...(width ? { width } : {}),
    ...(height ? { height } : {})
  };

  const response = await fetch(VENICE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VENICE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Venice API error: ${response.status} ${errorBody}`);
  }

  const data = await response.json().catch(() => ({}));
  const extracted = extractImagePayload(data);
  if (extracted.base64) {
    const decoded = decodeBase64(extracted.base64, extracted.mime);
    return {
      buffer: decoded.buffer,
      mime: decoded.mime,
      width: extracted.width ?? width,
      height: extracted.height ?? height,
      requestId: extracted.requestId
    };
  }

  if (extracted.url) {
    const imageRes = await fetch(extracted.url);
    if (!imageRes.ok) {
      throw new Error(`Image fetch failed: ${imageRes.status}`);
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    const mime = imageRes.headers.get("content-type") ?? "image/webp";
    return {
      buffer: Buffer.from(arrayBuffer),
      mime,
      width: extracted.width ?? width,
      height: extracted.height ?? height,
      requestId: extracted.requestId
    };
  }

  throw new Error("Venice API returned no image data");
}

async function logEvent(job: AiJob, eventType: string, detail: Record<string, unknown> = {}) {
  const { error } = await supa.from("ai_job_events").insert({
    user_id: job.user_id,
    job_id: job.id,
    event_type: eventType,
    detail
  });
  if (error) {
    process.stderr.write(`ai_job_event_failed:${error.message}\n`);
  }
}

async function finalizeFailure(job: AiJob, message: string) {
  const status = job.attempt_count >= job.max_attempts ? "failed" : "queued";
  const now = new Date().toISOString();
  await supa
    .from("ai_jobs")
    .update({
      status,
      error: message,
      locked_at: null,
      locked_by: null,
      updated_at: now
    })
    .eq("id", job.id);
}

async function finalizeSuccess(job: AiJob, result: ImageResult, storagePath: string) {
  const now = new Date().toISOString();
  await supa
    .from("ai_jobs")
    .update({
      status: "succeeded",
      error: null,
      provider_request_id: result.requestId ?? null,
      locked_at: null,
      locked_by: null,
      updated_at: now
    })
    .eq("id", job.id);

  await supa.from("ai_assets").insert({
    user_id: job.user_id,
    job_id: job.id,
    kind: "image",
    storage_bucket: "ai",
    storage_path: storagePath,
    mime_type: result.mime,
    width: result.width ?? null,
    height: result.height ?? null
  });
}

async function claimNextJob(workerId: string, lockSeconds: number): Promise<AiJob | null> {
  const { data, error } = await supa.rpc("claim_next_ai_image_job", {
    lock_seconds: lockSeconds,
    worker_id: workerId
  });
  if (error) throw error;
  const rows = (data ?? []) as AiJob[];
  return rows[0] ?? null;
}

export async function processAiImageJobs({
  workerId,
  lockSeconds,
  batchSize,
  log
}: {
  workerId: string;
  lockSeconds: number;
  batchSize: number;
  log: Logger;
}) {
  let processed = 0;
  for (let i = 0; i < batchSize; i += 1) {
    const job = await claimNextJob(workerId, lockSeconds);
    if (!job) break;
    processed += 1;
    const start = Date.now();
    try {
      await logEvent(job, "claimed", { worker_id: workerId, attempt: job.attempt_count, model: job.model });
      const result = await fetchImage(job);
      const ext = extensionForMime(result.mime);
      const storagePath = `images/${job.user_id}/${job.id}-${randomUUID()}.${ext}`;
      const upload = await supa.storage.from("ai").upload(storagePath, result.buffer, {
        contentType: result.mime,
        upsert: true
      });
      if (upload.error) throw upload.error;
      await finalizeSuccess(job, result, storagePath);
      await logEvent(job, "succeeded", {
        worker_id: workerId,
        storage_path: storagePath,
        duration_ms: Date.now() - start,
        model: job.model
      });
      log("info", "ai_job_succeeded", { job_id: job.id, storage_path: storagePath, model: job.model });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      await finalizeFailure(job, message);
      await logEvent(job, "failed", {
        worker_id: workerId,
        error_message: message,
        duration_ms: Date.now() - start,
        model: job.model
      });
      log("error", "ai_job_failed", { job_id: job.id, error_message: message, model: job.model });
    }
  }
  return processed;
}
