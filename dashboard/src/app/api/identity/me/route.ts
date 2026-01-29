import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function GET(request: Request) {
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

    const { data: identity, error: identityError } = await supa
      .rpc("ensure_identity", { p_user_id: data.user.id })
      .single();
    if (identityError) throw identityError;
    const identityRow = identity as
      | { did?: string | null; handle?: string | null; did_type?: string | null; username?: string | null }
      | null;

    return NextResponse.json({
      did: identityRow?.did ?? null,
      handle: identityRow?.handle ?? null,
      did_type: identityRow?.did_type ?? null,
      username: identityRow?.username ?? null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load identity" }, { status: 500 });
  }
}
