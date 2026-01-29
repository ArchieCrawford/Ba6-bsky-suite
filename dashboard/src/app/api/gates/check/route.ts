import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/spaces/server";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type GateCheckBody = {
  target_type?: string;
  target_id?: string;
  action?: string;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, reason: "unauthorized" }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as GateCheckBody;
    const targetType = typeof body.target_type === "string" ? body.target_type.trim() : "";
    const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (!targetId || !action) {
      return NextResponse.json({ error: "Missing target or action" }, { status: 400 });
    }

    if (targetType === "feed" || targetType === "space") {
      await requireGateAccess({
        supa,
        userId: user.id,
        targetId,
        targetType: targetType as "feed" | "space",
        action
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json(
        { ok: false, reason: err.reason, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json({ error: err?.message ?? "Gate check failed" }, { status: 500 });
  }
}
