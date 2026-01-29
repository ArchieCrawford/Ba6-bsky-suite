import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/spaces/server";
import { withChatAgent, isAtprotoSessionError } from "@/lib/atproto/getAtprotoAgentFromSession";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ convoId: string }> }) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const { convoId } = await context.params;
    if (!convoId) {
      return NextResponse.json({ error: "Missing convo id" }, { status: 400 });
    }

    const data = await withChatAgent(supa, user.id, (agent) =>
      agent.chat.bsky.convo.getMessages({ convoId, limit: 50 })
    );

    return NextResponse.json({ messages: data.data.messages ?? [] });
  } catch (err: any) {
    if (isAtprotoSessionError(err)) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Failed to load messages" }, { status: 500 });
  }
}
