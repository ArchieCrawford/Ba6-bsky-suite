import { createSupabaseServerClient } from "@/lib/supabaseServer";

export type SpaceMembership = {
  role: "owner" | "admin" | "member";
  status: "active" | "banned";
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function getAuthedSupabase(request: Request) {
  const token = getBearerToken(request);
  if (!token) return { error: "Missing auth token" as const };
  const supa = createSupabaseServerClient(token);
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return { error: "Invalid auth token" as const };
  const { data: identity } = await supa.rpc("ensure_identity", { p_user_id: data.user.id }).single();
  return { supa, user: data.user, identity };
}

export async function getSpaceMembership(
  supa: ReturnType<typeof createSupabaseServerClient>,
  spaceId: string,
  userId: string
) {
  const { data } = await supa
    .from("space_members")
    .select("role,status")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as SpaceMembership | null;
}

export function isOwnerOrAdmin(membership?: SpaceMembership | null) {
  return membership?.status === "active" && (membership.role === "owner" || membership.role === "admin");
}
