import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/spaces/server";

export const runtime = "nodejs";

type CreatePayload = {
  name?: string;
  slug?: string;
  description?: string | null;
  join_mode?: "public" | "moderated" | "invite_only";
};

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function POST(request: Request) {
  try {
    const auth = await getAuthedSupabase(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { supa, user } = auth;

    const body = (await request.json().catch(() => ({}))) as CreatePayload;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug = typeof body.slug === "string" ? normalizeSlug(body.slug) : normalizeSlug(name);
    const joinMode = body.join_mode ?? "public";

    if (!name || !slug) {
      return NextResponse.json({ error: "Missing name or slug" }, { status: 400 });
    }

    const { data: spaceRow, error: spaceError } = await supa
      .from("spaces")
      .insert({
        owner_user_id: user.id,
        name,
        slug,
        description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
        join_mode: joinMode
      })
      .select("id")
      .single();
    if (spaceError) throw spaceError;

    const { error: memberError } = await supa.from("space_members").insert({
      space_id: spaceRow.id,
      user_id: user.id,
      role: "owner",
      status: "active"
    });
    if (memberError) throw memberError;

    return NextResponse.json({ ok: true, id: spaceRow.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Create failed" }, { status: 500 });
  }
}
