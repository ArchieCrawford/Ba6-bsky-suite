import { supabase } from "@/lib/supabaseClient";

type EnsureResult = { ok: true } | { ok: false; error: string };

const RETRY_DELAYS_MS = [0, 350, 700];

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureProfile(): Promise<EnsureResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { ok: false, error: userError.message };
  }
  const user = userData.user;
  if (!user) {
    return { ok: false, error: "Missing user session" };
  }

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    await wait(RETRY_DELAYS_MS[attempt]);
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      return { ok: false, error: error.message };
    }
    if (data?.id) {
      return { ok: true };
    }
  }

  return { ok: false, error: "Profile row missing. Please retry in a moment." };
}
