import { BskyAgent } from "@atproto/api";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseClientAny = SupabaseClient<any, "public", any>;

type AccountRow = {
  id: string;
  user_id: string;
  account_did: string;
  handle: string | null;
  app_password: string | null;
  vault_secret_id: string | null;
  is_active: boolean | null;
};

async function resolveAccountSecret(supa: SupabaseClientAny, account: AccountRow): Promise<string | null> {
  if (account.app_password) return account.app_password;
  if (!account.vault_secret_id) return null;
  const { data, error } = await supa.rpc("get_account_secret", { account_id: account.id });
  if (error) throw error;
  return data ?? null;
}

async function fetchActiveAccount(supa: SupabaseClientAny, userId: string): Promise<AccountRow> {
  const { data, error } = await supa
    .from("accounts")
    .select("id,user_id,account_did,handle,app_password,vault_secret_id,is_active")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as AccountRow[];
  const account = rows.find((row) => row.is_active !== false);
  if (!account) {
    throw new Error("No Bluesky account found");
  }
  return account;
}

export async function loginAgentForUser(supa: SupabaseClientAny, userId: string) {
  const account = await fetchActiveAccount(supa, userId);
  if (account.is_active === false) {
    throw new Error("Account is disabled");
  }
  const secret = await resolveAccountSecret(supa, account);
  if (!secret) {
    throw new Error("Missing app password for Bluesky account");
  }

  const service = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
  const agent = new BskyAgent({ service });
  const identifier = account.handle ?? account.account_did;
  const loginRes = await agent.login({ identifier, password: secret });

  if (loginRes.data.did && loginRes.data.did !== account.account_did) {
    throw new Error("Account DID mismatch");
  }

  const now = new Date().toISOString();
  await supa
    .from("accounts")
    .update({ last_auth_at: now, handle: loginRes.data.handle ?? account.handle })
    .eq("id", account.id);

  return { agent, account };
}
