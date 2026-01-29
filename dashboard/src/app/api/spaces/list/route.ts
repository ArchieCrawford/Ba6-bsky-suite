import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";
import { getAuthedSupabase } from "@/lib/spaces/server";
import { normalizeGateActions } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type SpaceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  join_mode: string;
};

type MemberRow = {
  space_id: string;
  status: string;
};

type GateRow = {
  space_id: string | null;
  config: Record<string, unknown> | null;
  is_enabled: boolean;
};

export async function GET(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const { data: spaces, error } = await supa
      .from("spaces")
      .select("id,name,slug,description,join_mode")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const rows = (spaces ?? []) as SpaceRow[];
    if (!rows.length) {
      return NextResponse.json({ spaces: [] });
    }

    const spaceIds = rows.map((row) => row.id);

    const { data: memberRows } = await supa
      .from("space_members")
      .select("space_id,status")
      .eq("user_id", user.id)
      .in("space_id", spaceIds);

    const memberSet = new Set(
      ((memberRows ?? []) as MemberRow[])
        .filter((row) => row.status === "active")
        .map((row) => row.space_id)
    );

    const service = createSupabaseServiceClient();
    const { data: gateRows } = await service
      .from("feed_gates")
      .select("space_id,config,is_enabled")
      .eq("target_type", "space")
      .eq("is_enabled", true)
      .in("space_id", spaceIds);

    const gatedByJoin = new Set<string>();
    for (const row of (gateRows ?? []) as GateRow[]) {
      if (!row.space_id) continue;
      const config = (row.config ?? {}) as Record<string, unknown>;
      let actions = normalizeGateActions(config.gate_actions);
      if (!actions.length && typeof config.action === "string" && config.action.trim()) {
        actions = [config.action.trim()];
      }
      if (actions.includes("join")) gatedByJoin.add(row.space_id);
    }

    const response = rows.map((row) => ({
      ...row,
      is_member: memberSet.has(row.id),
      is_gated: gatedByJoin.has(row.id)
    }));

    return NextResponse.json({ spaces: response });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to list spaces" }, { status: 500 });
  }
}
