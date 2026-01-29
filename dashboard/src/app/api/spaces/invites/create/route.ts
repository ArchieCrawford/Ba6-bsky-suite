import { NextResponse } from "next/server";
import { getAuthedSupabase, getSpaceMembership, isOwnerOrAdmin } from "@/lib/spaces/server";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type InvitePayload = {
  space_id?: string;
  expires_at?: string | null;
  max_uses?: number | null;
};

const generateCode = () => {
  return crypto.randomUUID().split("-")[0];
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as InvitePayload;
    const spaceId = typeof body.space_id === "string" ? body.space_id.trim() : "";
    if (!spaceId) {
      return NextResponse.json({ error: "Missing space id" }, { status: 400 });
    }

    const membership = await getSpaceMembership(supa, spaceId, user.id);
    if (!isOwnerOrAdmin(membership)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await requireGateAccess({
      supa,
      userId: user.id,
      targetId: spaceId,
      targetType: "space",
      action: "invite_members"
    });

    const code = generateCode();
    const { error } = await supa.from("space_invites").insert({
      space_id: spaceId,
      code,
      created_by: user.id,
      expires_at: body.expires_at ?? null,
      max_uses: body.max_uses ?? null
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, code });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Invite failed" }, { status: 500 });
  }
}
