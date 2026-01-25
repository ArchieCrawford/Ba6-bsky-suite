import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error("Missing env: SUPABASE_URL");
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

export const supa = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
