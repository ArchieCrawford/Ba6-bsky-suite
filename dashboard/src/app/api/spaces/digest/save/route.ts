import { NextResponse } from "next/server";
import { getAuthedSupabase, getSpaceMembership, isOwnerOrAdmin } from "@/lib/spaces/server";
import { requireGateAccess, isGateAccessError } from "@/lib/gates/enforce";

export const runtime = "nodejs";

type DigestPayload = {
  space_id?: string;
  include_keywords?: string[];
  exclude_keywords?: string[];
  lang?: string | null;
  include_mode?: "any" | "all";
  case_insensitive?: boolean;
  sources?: Array<{ type?: string; did?: string }>;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as DigestPayload;
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
      action: "configure_digest"
    });

    const payload = {
      space_id: spaceId,
      include_keywords: Array.isArray(body.include_keywords) ? body.include_keywords : [],
      exclude_keywords: Array.isArray(body.exclude_keywords) ? body.exclude_keywords : [],
      lang: typeof body.lang === "string" && body.lang.trim() ? body.lang.trim() : null,
      include_mode: body.include_mode === "all" ? "all" : "any",
      case_insensitive: body.case_insensitive !== false,
      sources: Array.isArray(body.sources) ? body.sources : []
    };

    const { error } = await supa
      .from("space_digests")
      .upsert(payload, { onConflict: "space_id" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isGateAccessError(err)) {
      return NextResponse.json({ ok: false, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message ?? "Save failed" }, { status: 500 });
  }
}
