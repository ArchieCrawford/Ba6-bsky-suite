import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function createSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}
