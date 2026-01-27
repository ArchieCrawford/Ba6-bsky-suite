import { supabase } from "@/lib/supabaseClient";

type EnsureResult = { ok: true } | { ok: false; error: string };

function pickDisplayName(user: { user_metadata?: Record<string, unknown> } | null | undefined) {
  if (!user?.user_metadata) return null;
  const metadata = user.user_metadata;
  const fullName = metadata.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  const name = metadata.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return null;
}

export async function ensureUserProfile(): Promise<EnsureResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { ok: false, error: userError.message };
  }
  const user = userData.user;
  if (!user) {
    return { ok: false, error: "Missing user session" };
  }

  const { error: upsertError } = await supabase.from("users").upsert(
    {
      id: user.id,
      display_name: pickDisplayName(user)
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  return { ok: true };
}
