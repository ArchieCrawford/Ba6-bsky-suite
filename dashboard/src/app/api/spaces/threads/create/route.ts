import { NextResponse } from "next/server";
import { getAuthedSupabase, getSpaceMembership } from "@/lib/spaces/server";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type ThreadPayload = {
  space_id?: string;
  title?: string;
  body?: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as ThreadPayload;
    const spaceId = typeof body.space_id === "string" ? body.space_id.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.body === "string" ? body.body.trim() : null;
    if (!spaceId || !title) {
      return NextResponse.json({ error: "Missing space id or title" }, { status: 400 });
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
      action: "create_thread"
    });

    const { error } = await supa
      .from("space_threads")
      .insert({ space_id: spaceId, user_id: user.id, title, body: content });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Create failed" }, { status: 500 });
  }
}
