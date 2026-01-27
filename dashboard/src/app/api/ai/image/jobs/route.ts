import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL ?? "venice";
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? "25") || 25;

type CreateJobRequest = {
  prompt?: string;
  negativePrompt?: string;
  negative_prompt?: string;
  model?: string;
  size?: string;
  params?: Record<string, unknown>;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function startOfTodayUtc() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
}

function parseSize(size: string | undefined) {
  const raw = (size ?? "").trim();
  const match = raw.match(/^(\d{2,4})x(\d{2,4})$/i);
  if (!match) {
    return { size: "1024x1024", width: 1024, height: 1024 };
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return {
    size: `${width}x${height}`,
    width,
    height
  };
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supa = createSupabaseServerClient(token);
    const { data, error: authError } = await supa.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CreateJobRequest;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
    const { size, width, height } = parseSize(body.size);
    const negativePrompt =
      typeof body.negativePrompt === "string"
        ? body.negativePrompt.trim()
        : typeof body.negative_prompt === "string"
          ? body.negative_prompt.trim()
          : "";

    const { data: activeRows, error: activeError } = await supa
      .from("ai_jobs")
      .select("id")
      .eq("user_id", data.user.id)
      .in("status", ["queued", "running"])
      .limit(1);
    if (activeError) throw activeError;
    if (activeRows && activeRows.length > 0) {
      return NextResponse.json({ error: "You already have an active job." }, { status: 409 });
    }

    const { count, error: countError } = await supa
      .from("ai_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .gte("created_at", startOfTodayUtc());
    if (countError) throw countError;
    if (typeof count === "number" && count >= DAILY_LIMIT) {
      return NextResponse.json({ error: "Daily limit reached." }, { status: 429 });
    }

    const params = {
      ...(body.params ?? {}),
      size,
      width,
      height
    };

    const { data: job, error: insertError } = await supa
      .from("ai_jobs")
      .insert({
        user_id: data.user.id,
        kind: "image",
        status: "queued",
        provider: "venice",
        model,
        prompt,
        ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
        params
      })
      .select("id,status,model,prompt,negative_prompt,params,created_at")
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ job });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to create job" }, { status: 500 });
  }
}
