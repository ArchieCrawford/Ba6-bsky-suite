import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getVeniceModels } from "@/lib/veniceModels";

export const runtime = "nodejs";

const DAILY_LIMIT = Number(process.env.AI_TEXT_DAILY_LIMIT ?? process.env.AI_DAILY_LIMIT ?? "25") || 25;
const VENICE_TEXT_URL = process.env.VENICE_TEXT_API_URL ?? "https://api.venice.ai/api/v1/chat/completions";

type GenerateTextRequest = {
  label?: string;
  prompt?: string;
  model?: string;
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

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isMissingTableError(error: any, table: string) {
  const code = error?.code;
  const message = String(error?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("could not find the table") && message.includes(table)) ||
    (message.includes("schema cache") && message.includes(table)) ||
    (message.includes("relation") && message.includes("does not exist") && message.includes(table))
  );
}

async function getUsageCount(supa: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { count, error } = await supa
    .from("ai_text_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfTodayUtc());
  if (error) {
    if (isMissingTableError(error, "ai_text_runs")) return null;
    throw error;
  }
  return typeof count === "number" ? count : 0;
}

async function recordTextRun(
  supa: ReturnType<typeof createSupabaseServerClient>,
  payload: { user_id: string; model: string; prompt: string; label?: string | null }
) {
  const { error } = await supa.from("ai_text_runs").insert({
    user_id: payload.user_id,
    model: payload.model,
    prompt: payload.prompt,
    label: payload.label ?? null
  });
  if (error && !isMissingTableError(error, "ai_text_runs")) {
    console.warn("ai_text_runs insert failed", error.message ?? error);
  }
}

function coerceContent(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item) {
          return (item as any).text ?? (item as any).content ?? "";
        }
        return "";
      })
      .join("");
    return joined.trim() ? joined : null;
  }
  if (typeof value === "object") {
    const content = (value as any).text ?? (value as any).content;
    return typeof content === "string" ? content : null;
  }
  return null;
}

function extractOutputText(payload: any): string | null {
  return (
    coerceContent(payload?.choices?.[0]?.message?.content) ||
    coerceContent(payload?.choices?.[0]?.text) ||
    coerceContent(payload?.output?.text) ||
    coerceContent(payload?.output) ||
    coerceContent(payload?.text) ||
    coerceContent(payload?.data?.[0]?.text)
  );
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supa = createSupabaseServerClient(token);
    const { data, error: authError } = await supa.auth.getUser();
    if (authError || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as GenerateTextRequest;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const models = await getVeniceModels({ type: "text" });
    const validModels = new Set(models.map((model) => model.id));
    const modelId = typeof body.model === "string" ? body.model.trim() : "";
    if (!modelId || !validModels.has(modelId)) {
      return NextResponse.json({ error: "Select a valid Venice text model." }, { status: 400 });
    }

    let usedToday: number | null = null;
    try {
      usedToday = await getUsageCount(supa, data.user.id);
    } catch (error: any) {
      return NextResponse.json({ error: error?.message ?? "Usage check failed" }, { status: 500 });
    }
    if (usedToday !== null && usedToday >= DAILY_LIMIT) {
      return NextResponse.json({ error: "Daily text limit reached." }, { status: 429 });
    }

    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing VENICE_API_KEY" }, { status: 500 });
    }

    const params = (body.params ?? {}) as Record<string, unknown>;
    const temperature = parseNumber(params.temperature);
    const maxTokens = parseNumber(params.max_tokens ?? (params as any).maxTokens ?? (params as any).max_completion_tokens);

    const response = await fetch(VENICE_TEXT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        ...(typeof temperature === "number" ? { temperature } : {}),
        ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {})
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Venice API error: ${response.status} ${errorBody}` },
        { status: 502 }
      );
    }

    const payload = await response.json().catch(() => ({}));
    const outputText = extractOutputText(payload);
    if (!outputText) {
      return NextResponse.json({ error: "Venice returned no text output." }, { status: 502 });
    }

    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (usedToday !== null) {
      await recordTextRun(supa, {
        user_id: data.user.id,
        model: modelId,
        prompt,
        label: label || null
      });
    }

    return NextResponse.json({ text: outputText });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to generate text" }, { status: 500 });
  }
}
