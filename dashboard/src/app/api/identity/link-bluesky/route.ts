import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type LinkPayload = {
  did?: string;
  handle?: string;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
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

    const body = (await request.json().catch(() => ({}))) as LinkPayload;
    const did = typeof body.did === "string" ? body.did.trim() : "";
    const handle = typeof body.handle === "string" ? body.handle.trim() : "";
    if (!did || !did.startsWith("did:") || did.length < 6) {
      return NextResponse.json({ error: "Invalid DID" }, { status: 400 });
    }

    const service = createSupabaseServiceClient();
    const { data: existing } = await service.from("identities").select("user_id").eq("did", did).maybeSingle();
    if (existing && existing.user_id !== data.user.id) {
      return NextResponse.json({ error: "DID already linked to another user" }, { status: 409 });
    }

    const { data: identity, error: identityError } = await supa
      .rpc("ensure_identity", { p_user_id: data.user.id })
      .single();
    if (identityError) throw identityError;
    const identityRow = identity as { id: string } | null;
    if (!identityRow?.id) {
      throw new Error("Identity not found");
    }

    const { error: updateError } = await supa
      .from("identities")
      .update({ did, did_type: "bluesky", handle: handle || null })
      .eq("id", identityRow.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to link DID" }, { status: 500 });
  }
}
