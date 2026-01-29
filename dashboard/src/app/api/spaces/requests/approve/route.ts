import { NextResponse } from "next/server";
import { getAuthedSupabase, getSpaceMembership, isOwnerOrAdmin } from "@/lib/spaces/server";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type ApprovePayload = { request_id?: string };

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as ApprovePayload;
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if (!requestId) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    const { data: requestRow, error: requestError } = await supa
      .from("space_join_requests")
      .select("id,space_id,user_id,status")
      .eq("id", requestId)
      .single();
    if (requestError) throw requestError;

    const membership = await getSpaceMembership(supa, requestRow.space_id, user.id);
    if (!isOwnerOrAdmin(membership)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await requireGateAccess({
      supa,
      userId: user.id,
      targetId: requestRow.space_id,
      targetType: "space",
      action: "moderate"
    });

    const { error: memberError } = await supa
      .from("space_members")
      .insert({ space_id: requestRow.space_id, user_id: requestRow.user_id, role: "member", status: "active" });
    if (memberError && memberError.code !== "23505") throw memberError;

    const { error: updateError } = await supa
      .from("space_join_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq("id", requestId);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Approve failed" }, { status: 500 });
  }
}
