import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";
import { getAuthedSupabase } from "@/lib/spaces/server";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type JoinPayload = {
  space_id?: string;
  invite_code?: string;
};

type InviteRow = {
  id: string;
  space_id: string;
  uses: number;
  max_uses: number | null;
  expires_at: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as JoinPayload;
    const inviteCode = typeof body.invite_code === "string" ? body.invite_code.trim() : "";
    let spaceId = typeof body.space_id === "string" ? body.space_id.trim() : "";
    let inviteRow: InviteRow | null = null;

    if (inviteCode) {
      const service = createSupabaseServiceClient();
      const { data, error } = await service
        .from("space_invites")
        .select("id,space_id,uses,max_uses,expires_at")
        .eq("code", inviteCode)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return NextResponse.json({ error: "Invite code expired" }, { status: 410 });
      }
      if (data.max_uses != null && data.uses >= data.max_uses) {
        return NextResponse.json({ error: "Invite code has no remaining uses" }, { status: 409 });
      }
      inviteRow = data as InviteRow;
      spaceId = data.space_id;
    }

    if (!spaceId) {
      return NextResponse.json({ error: "Missing space id" }, { status: 400 });
    }

    const { data: space, error: spaceError } = await supa
      .from("spaces")
      .select("id,join_mode")
      .eq("id", spaceId)
      .maybeSingle();
    if (spaceError) throw spaceError;
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const { data: memberRow } = await supa
      .from("space_members")
      .select("id")
      .eq("space_id", spaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberRow) {
      return NextResponse.json({ ok: true, already_member: true });
    }

    await requireGateAccess({
      supa,
      userId: user.id,
      targetId: spaceId,
      targetType: "space",
      action: "join"
    });

    if (space.join_mode === "moderated") {
      const { error } = await supa
        .from("space_join_requests")
        .insert({ space_id: spaceId, user_id: user.id, status: "pending" });
      if (error && error.code !== "23505") throw error;
      return NextResponse.json({ ok: true, pending: true });
    }

    if (space.join_mode === "invite_only" && !inviteRow) {
      return NextResponse.json({ error: "Invite code required" }, { status: 403 });
    }

    const memberClient = inviteRow ? createSupabaseServiceClient() : supa;
    const { error: insertError } = await memberClient
      .from("space_members")
      .insert({ space_id: spaceId, user_id: user.id, role: "member", status: "active" });
    if (insertError && insertError.code !== "23505") throw insertError;

    if (inviteRow) {
      const service = createSupabaseServiceClient();
      const { error: updateError } = await service
        .from("space_invites")
        .update({ uses: inviteRow.uses + 1 })
        .eq("id", inviteRow.id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Join failed" }, { status: 500 });
  }
}
