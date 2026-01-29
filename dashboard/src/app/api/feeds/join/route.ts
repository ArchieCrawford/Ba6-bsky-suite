import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type JoinPayload = {
  feed_id?: string;
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

    const body = (await request.json().catch(() => ({}))) as JoinPayload;
    const feedId = typeof body.feed_id === "string" ? body.feed_id.trim() : "";
    if (!feedId) {
      return NextResponse.json({ error: "Missing feed id" }, { status: 400 });
    }

    await requireGateAccess({
      supa,
      userId: data.user.id,
      targetId: feedId,
      targetType: "feed",
      action: "join"
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Join failed" }, { status: 500 });
  }
}
