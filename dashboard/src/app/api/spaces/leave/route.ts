import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/spaces/server";

export const runtime = "nodejs";

type LeavePayload = { space_id?: string };

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as LeavePayload;
    const spaceId = typeof body.space_id === "string" ? body.space_id.trim() : "";
    if (!spaceId) {
      return NextResponse.json({ error: "Missing space id" }, { status: 400 });
    }

    const { error } = await supa.from("space_members").delete().eq("space_id", spaceId).eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Leave failed" }, { status: 500 });
  }
}
