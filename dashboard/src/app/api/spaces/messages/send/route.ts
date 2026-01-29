import { NextResponse } from "next/server";
import { getAuthedSupabase, getSpaceMembership } from "@/lib/spaces/server";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type MessagePayload = {
  space_id?: string;
  body?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as MessagePayload;
    const spaceId = typeof body.space_id === "string" ? body.space_id.trim() : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!spaceId || !text) {
      return NextResponse.json({ error: "Missing space id or body" }, { status: 400 });
    }

    const membership = await getSpaceMembership(supa, spaceId, user.id);
    if (!membership || membership.status !== "active") {
      return NextResponse.json({ error: "Not a space member" }, { status: 403 });
    }

    await requireGateAccess({
      supa,
      userId: user.id,
      targetId: spaceId,
      targetType: "space",
      action: "send_message"
    });

    const { error } = await supa
      .from("space_messages")
      .insert({ space_id: spaceId, user_id: user.id, body: text });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Send failed" }, { status: 500 });
  }
}
