import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { isGateAccessError, requireGateAccess } from "@/lib/gates/enforce";
import { loginAgentForUser } from "@/lib/atproto";

export const runtime = "nodejs";

type FollowPayload = {
  feed_id?: string;
  subject_did?: string;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function isNotConfigured(message: string) {
  return (
    message.includes("No Bluesky account") ||
    message.includes("Missing app password") ||
    message.includes("Account is disabled")
  );
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supa = createSupabaseServerClient(token);
    const { data, error: authError } = await supa.auth.getUser();
    if (authError || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as FollowPayload;
    const feedId = typeof body.feed_id === "string" ? body.feed_id : "";
    const subjectDid = typeof body.subject_did === "string" ? body.subject_did.trim() : "";
    if (!feedId || !subjectDid) {
      return NextResponse.json({ error: "Missing feed or subject" }, { status: 400 });
    }

    await requireGateAccess({ supa, userId: data.user.id, feedId, action: "follow_via_ba6" });

    const { agent, account } = await loginAgentForUser(supa, data.user.id);
    const now = new Date().toISOString();

    await agent.api.com.atproto.repo.createRecord({
      repo: account.account_did,
      collection: "app.bsky.graph.follow",
      record: { subject: subjectDid, createdAt: now }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason }, { status: err.status });
    }
    const message = err?.message ?? "Failed to follow";
    if (isNotConfigured(message)) {
      return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
