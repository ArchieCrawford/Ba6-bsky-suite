import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type EnsureResult = { ok: true } | { ok: false; error: string };

type WalletInfo = { wallet_chain?: string; wallet_address?: string };

function normalizeChain(value?: string | null) {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes("sol")) return "solana";
  if (lower.includes("eth")) return "ethereum";
  return value;
}

function extractWalletInfo(user: User): WalletInfo {
  const identities = user.identities ?? [];
  for (const identity of identities) {
    const data = (identity as any)?.identity_data ?? {};
    const address = data.address ?? data.wallet_address ?? data.public_key ?? data.pubkey;
    const chain = normalizeChain(data.chain ?? data.network ?? data.chain_id ?? identity.provider);
    if (address || chain) {
      return {
        ...(chain ? { wallet_chain: String(chain) } : {}),
        ...(address ? { wallet_address: String(address) } : {})
      };
    }
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackAddress = metadata.wallet_address ?? metadata.address ?? metadata.public_key;
  const fallbackChain = normalizeChain(metadata.wallet_chain as string | undefined);

  return {
    ...(fallbackChain ? { wallet_chain: String(fallbackChain) } : {}),
    ...(fallbackAddress ? { wallet_address: String(fallbackAddress) } : {})
  };
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

  const now = new Date().toISOString();
  const walletInfo = extractWalletInfo(user);

  const payload: Record<string, unknown> = {
    id: user.id,
    created_at: now,
    updated_at: now,
    last_seen_at: now,
    ...walletInfo
  };

  const { error: upsertError } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  return { ok: true };
}
