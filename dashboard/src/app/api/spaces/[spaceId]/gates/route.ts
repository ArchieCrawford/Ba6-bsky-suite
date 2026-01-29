import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const ALLOWED_GATES = new Set(["hashtag_opt_in", "token_gate", "pay_gate", "manual_approval", "follow_gate"]);

type GatePayload = {
  gateId?: string;
  gateType?: string;
  mode?: string | null;
  config?: Record<string, unknown>;
  isEnabled?: boolean;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function GET(request: Request, context: { params: Promise<{ spaceId: string }> }) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const supa = createSupabaseServerClient(token);
    const { data: userData, error: authError } = await supa.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const { spaceId } = await context.params;
    const { data, error } = await supa
      .from("feed_gates")
      .select("id,space_id,gate_type,mode,config,is_enabled,created_at,updated_at")
      .eq("space_id", spaceId)
      .eq("target_type", "space")
      .order("created_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ gates: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load gates" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ spaceId: string }> }) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const supa = createSupabaseServerClient(token);
    const { data: userData, error: authError } = await supa.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const { spaceId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as GatePayload;
    const gateType = typeof body.gateType === "string" ? body.gateType : "";

    if (!ALLOWED_GATES.has(gateType)) {
      return NextResponse.json({ error: "Invalid gate type" }, { status: 400 });
    }

    const payload = {
      space_id: spaceId,
      target_type: "space",
      gate_type: gateType,
      mode: body.mode ?? null,
      config: body.config ?? {},
      is_enabled: body.isEnabled ?? true
    };

    if (body.gateId) {
      const { error } = await supa
        .from("feed_gates")
        .update(payload)
        .eq("id", body.gateId)
        .eq("space_id", spaceId)
        .eq("target_type", "space");
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await supa.from("feed_gates").insert(payload).select("id").single();
    if (error) throw error;

    return NextResponse.json({ ok: true, gate_id: data?.id ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to save gate" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ spaceId: string }> }) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const supa = createSupabaseServerClient(token);
    const { data: userData, error: authError } = await supa.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const { spaceId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { gateId?: string };
    if (!body.gateId) {
      return NextResponse.json({ error: "Missing gate id" }, { status: 400 });
    }

    const { error } = await supa
      .from("feed_gates")
      .delete()
      .eq("id", body.gateId)
      .eq("space_id", spaceId)
      .eq("target_type", "space");
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to delete gate" }, { status: 500 });
  }
}
