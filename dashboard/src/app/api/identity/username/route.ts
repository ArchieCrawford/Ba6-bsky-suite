import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type UsernamePayload = {
  username?: string | null;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function normalizeUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supa = createSupabaseServerClient(token);
    const { data, error } = await supa.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as UsernamePayload;
    const normalized = normalizeUsername(body.username);

    if (normalized && !/^[a-z][a-z0-9_]{2,19}$/.test(normalized)) {
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }

    const { data: identity, error: identityError } = await supa
      .rpc("ensure_identity", { p_user_id: data.user.id })
      .single();
    if (identityError) throw identityError;
    const identityRow = identity as { id: string } | null;
    if (!identityRow?.id) throw new Error("Identity not found");

    if (normalized) {
      const service = createSupabaseServiceClient();
      const { data: existing } = await service
        .from("identities")
        .select("id,user_id,username")
        .eq("username", normalized)
        .maybeSingle();
      if (existing && existing.user_id !== data.user.id) {
        return NextResponse.json({ error: "username_taken" }, { status: 409 });
      }
    }

    const { error: updateError } = await supa
      .from("identities")
      .update({ username: normalized })
      .eq("id", identityRow.id);
    if (updateError) {
      const message = updateError.message?.toLowerCase?.() ?? "";
      if (message.includes("identities_username") || message.includes("username")) {
        return NextResponse.json({ error: "username_taken" }, { status: 409 });
      }
      if (message.includes("identities_username_format")) {
        return NextResponse.json({ error: "invalid_username" }, { status: 400 });
      }
      throw updateError;
    }

    return NextResponse.json({ ok: true, username: normalized });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to update username" }, { status: 500 });
  }
}
