import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { ENV } from "./env";

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key)
};

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!client) {
    const url = ENV.SUPABASE_URL;
    const key = ENV.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase env missing");
    }
    client = createClient(url, key, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  }
  return client;
}
