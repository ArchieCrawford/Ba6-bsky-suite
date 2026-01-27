import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? "25") || 25;
const SIGNED_URL_TTL = Number(process.env.AI_SIGNED_URL_TTL ?? "3600") || 3600;

type AiJobRow = {
  id: string;
  status: string;
  model: string;
  prompt: string;
  negative_prompt: string | null;
  params: Record<string, unknown> | null;
  provider: string;
  created_at: string;
  updated_at: string;
  error: string | null;
};

type AiAssetRow = {
  id: string;
  job_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  created_at: string;
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

export async function GET(request: Request) {
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

    const { data: jobs, error: jobsError } = await supa
      .from("ai_jobs")
      .select("id,status,model,prompt,negative_prompt,params,provider,created_at,updated_at,error")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (jobsError) throw jobsError;

    const { data: assets, error: assetsError } = await supa
      .from("ai_assets")
      .select("id,job_id,storage_bucket,storage_path,mime_type,width,height,created_at")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (assetsError) throw assetsError;

    const paths = (assets ?? []).map((asset) => asset.storage_path);
    const signedUrlMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed, error: signedError } = await supa.storage
        .from("ai")
        .createSignedUrls(paths, SIGNED_URL_TTL);
      if (signedError) throw signedError;
      signed?.forEach((entry) => {
        if (entry?.signedUrl && entry.path) {
          signedUrlMap.set(entry.path, entry.signedUrl);
        }
      });
    }

    const assetsWithUrls = (assets ?? []).map((asset) => ({
      ...asset,
      signed_url: signedUrlMap.get(asset.storage_path) ?? null
    }));

    const { count: usedToday, error: countError } = await supa
      .from("ai_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .gte("created_at", startOfTodayUtc());
    if (countError) throw countError;

    const { count: activeCount, error: activeError } = await supa
      .from("ai_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .in("status", ["queued", "running"]);
    if (activeError) throw activeError;

    return NextResponse.json({
      jobs: (jobs ?? []) as AiJobRow[],
      assets: assetsWithUrls as (AiAssetRow & { signed_url: string | null })[],
      usage: {
        daily_limit: DAILY_LIMIT,
        used_today: usedToday ?? 0,
        active_count: activeCount ?? 0
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load jobs" }, { status: 500 });
  }
}
