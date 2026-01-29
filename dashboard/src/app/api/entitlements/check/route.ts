import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getPayGateForAction, hasEntitlement } from "@/lib/billing";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

type EntitlementsPayload = {
  lookupKey?: string;
  feedId?: string;
  gateAction?: string;
  targetType?: string;
  targetId?: string;
};

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

    const body = (await request.json().catch(() => ({}))) as EntitlementsPayload;
    let lookupKey = typeof body.lookupKey === "string" ? body.lookupKey.trim() : "";

    if (!lookupKey && (body.feedId || body.targetId) && body.gateAction) {
      const targetType = body.targetType === "space" ? "space" : "feed";
      const targetId = typeof body.targetId === "string" ? body.targetId : body.feedId;
      if (typeof targetId === "string" && targetId) {
        const gate = await getPayGateForAction(supa, targetId, body.gateAction, targetType);
        lookupKey = typeof gate?.config?.lookup_key === "string" ? gate.config.lookup_key.trim() : "";
      }
    }

    if (!lookupKey) {
      return NextResponse.json({ status: "unknown" });
    }

    const ok = await hasEntitlement(data.user.id, lookupKey);
    return NextResponse.json({ status: ok ? "active" : "locked" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Entitlements check failed" }, { status: 500 });
  }
}
