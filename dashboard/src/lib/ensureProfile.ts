import { supabase } from "@/lib/supabaseClient";

type EnsureResult = { ok: true } | { ok: false; error: string };

export async function ensureProfile(): Promise<EnsureResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { ok: false, error: userError.message };
  }
  const user = userData.user;
  if (!user) {
    return { ok: false, error: "Missing user session" };
  }

  const { error: upsertError } = await supabase
    .from("users")
    .upsert({ id: user.id }, { onConflict: "id" });

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  return { ok: true };
}
