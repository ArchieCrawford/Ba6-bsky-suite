import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/spaces/server";
import { withChatAgent, isAtprotoSessionError } from "@/lib/atproto/getAtprotoAgentFromSession";

export const runtime = "nodejs";

type MarkReadPayload = {
  convoId?: string;
  messageId?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as MarkReadPayload;
    const convoId = typeof body.convoId === "string" ? body.convoId.trim() : "";
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : undefined;
    if (!convoId) {
      return NextResponse.json({ error: "Missing convo id" }, { status: 400 });
    }

    await withChatAgent(supa, user.id, (agent) =>
      agent.chat.bsky.convo.updateRead({ convoId, messageId })
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isAtprotoSessionError(err)) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Failed to mark read" }, { status: 500 });
  }
}
