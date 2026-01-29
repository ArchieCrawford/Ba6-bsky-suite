import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/spaces/server";
import { withChatAgent, isAtprotoSessionError } from "@/lib/atproto/getAtprotoAgentFromSession";
import { resolveRecipient } from "@/lib/identity/resolveRecipient";

export const runtime = "nodejs";

type SendPayload = {
  convoId?: string;
  recipient?: string;
  text?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user, identity } = auth;

    const body = (await request.json().catch(() => ({}))) as SendPayload;
    const convoId = typeof body.convoId === "string" ? body.convoId.trim() : "";
    const recipient = typeof body.recipient === "string" ? body.recipient.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    const result = await withChatAgent(supa, user.id, async (agent) => {
      let finalConvoId = convoId;

      if (!finalConvoId) {
        if (!recipient) {
          throw new Error("Recipient is required");
        }
        const resolved = await resolveRecipient(recipient);

        if (
          identity?.did_type === "bluesky" &&
          identity?.did &&
          resolved.did === identity.did &&
          resolved.handle &&
          resolved.handle !== identity.handle
        ) {
          await supa
            .from("identities")
            .update({ handle: resolved.handle })
            .eq("user_id", user.id);
        }

        const convoRes = await agent.chat.bsky.convo.getConvoForMembers({ members: [resolved.did] });
        finalConvoId = convoRes.data.convo.id;
      }

      const sendRes = await agent.chat.bsky.convo.sendMessage({
        convoId: finalConvoId,
        message: { text }
      });

      return { convoId: finalConvoId, message: sendRes.data };
    });

    return NextResponse.json({ ok: true, convo_id: result.convoId, message: result.message });
  } catch (err: any) {
    if (isAtprotoSessionError(err)) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Failed to send message" }, { status: 500 });
  }
}
