import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getPayGateForAction, hasEntitlement } from "@/lib/billing";

export const runtime = "nodejs";

type JoinRequestPayload =
  | { action: "request"; requesterDid?: string }
  | { action: "approve" | "reject"; requestId?: string };

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function GET(request: Request, context: { params: Promise<{ feedId: string }> }) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const supa = createSupabaseServerClient(token);
    const { data: userData, error: authError } = await supa.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const { feedId } = await context.params;
    const { data, error } = await supa
      .from("feed_join_requests")
      .select("id,feed_id,requester_did,status,created_at")
      .eq("feed_id", feedId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ requests: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load join requests" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ feedId: string }> }) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const supa = createSupabaseServerClient(token);
    const { data: userData, error: authError } = await supa.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const { feedId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as JoinRequestPayload;

    if (body.action === "request") {
      const requesterDid = typeof body.requesterDid === "string" ? body.requesterDid.trim() : "";
      if (!requesterDid) {
        return NextResponse.json({ error: "Missing requester DID" }, { status: 400 });
      }

      const payGate = await getPayGateForAction(supa, feedId, "join");
      if (payGate) {
        const lookupKey = typeof payGate.config?.lookup_key === "string" ? payGate.config.lookup_key.trim() : "";
        if (!lookupKey) {
          return NextResponse.json({ error: "Pay gate missing lookup key" }, { status: 400 });
        }
        const ok = await hasEntitlement(userData.user.id, lookupKey);
        if (!ok) {
          return NextResponse.json({ ok: false, reason: "payment_required" }, { status: 402 });
        }
      }

      const { data: accountRow } = await supa
        .from("accounts")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("account_did", requesterDid)
        .maybeSingle();

      if (!accountRow) {
        return NextResponse.json({ error: "Requester DID not linked to this user" }, { status: 403 });
      }

      const { error: insertError } = await supa
        .from("feed_join_requests")
        .insert({ feed_id: feedId, requester_did: requesterDid, status: "pending" });
      if (insertError && insertError.code !== "23505") throw insertError;

      return NextResponse.json({ ok: true });
    }

    if (!body.requestId) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    const { data: requestRow, error: requestError } = await supa
      .from("feed_join_requests")
      .select("id,requester_did,status")
      .eq("id", body.requestId)
      .eq("feed_id", feedId)
      .single();
    if (requestError) throw requestError;

    if (body.action === "approve") {
      const { error: sourceError } = await supa.from("feed_sources").insert({
        feed_id: feedId,
        source_type: "account_list",
        account_did: requestRow.requester_did
      });
      if (sourceError && sourceError.code !== "23505") throw sourceError;
    }

    const { error: updateError } = await supa
      .from("feed_join_requests")
      .update({ status: body.action === "approve" ? "approved" : "rejected" })
      .eq("id", body.requestId);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to update join request" }, { status: 500 });
  }
}
