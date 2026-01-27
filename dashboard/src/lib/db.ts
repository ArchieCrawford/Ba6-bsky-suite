import { supabase } from "@/lib/supabaseClient";
import { consumePendingWallets, type PendingWallet } from "@/lib/magic";

export type WalletRow = {
  id: string;
  user_id: string;
  provider: string;
  chain: string;
  network: string | null;
  address: string;
  magic_issuer: string | null;
  magic_user_id: string | null;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

type WalletUpsertInput = PendingWallet & {
  network?: string | null;
  magic_issuer?: string | null;
  magic_user_id?: string | null;
  setDefault?: boolean;
};

type EnsureResult = { ok: true; wallet: WalletRow } | { ok: false; error: string };

export async function ensureUserAndWallet(input: WalletUpsertInput): Promise<EnsureResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return { ok: false, error: userError.message };
  }
  const user = userData.user;
  if (!user) {
    return { ok: false, error: "Missing user session" };
  }

  const { error: upsertUserError } = await supabase.from("users").upsert({ id: user.id }, { onConflict: "id" });
  if (upsertUserError) {
    return { ok: false, error: upsertUserError.message };
  }

  const payload = {
    user_id: user.id,
    provider: input.provider,
    chain: input.chain,
    network: input.network ?? null,
    address: input.address,
    magic_issuer: input.magic_issuer ?? null,
    magic_user_id: input.magic_user_id ?? null,
    is_default: input.setDefault ?? true
  };

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .upsert(payload, { onConflict: "provider,chain,address" })
    .select("id,user_id,provider,chain,network,address,magic_issuer,magic_user_id,is_default,is_verified,created_at,updated_at")
    .single();
  if (walletError) {
    return { ok: false, error: walletError.message };
  }
  return { ok: true, wallet: wallet as WalletRow };
}

export async function linkPendingWallets(): Promise<{ ok: true; linked: number } | { ok: false; error: string }> {
  const pending = consumePendingWallets();
  if (pending.length === 0) {
    return { ok: true, linked: 0 };
  }
  let linked = 0;
  for (const wallet of pending) {
    const result = await ensureUserAndWallet(wallet);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    linked += 1;
  }
  return { ok: true, linked };
}

export async function fetchWallets(): Promise<{ ok: true; wallets: WalletRow[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("wallets")
    .select("id,user_id,provider,chain,network,address,magic_issuer,magic_user_id,is_default,is_verified,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, wallets: (data ?? []) as WalletRow[] };
}
