"use client";

import { useEffect, useMemo, useState } from "react";
import bs58 from "bs58";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MobileCard } from "@/components/ui/MobileCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";
import {
  connectEvmInjected,
  connectSolanaInjected,
  detectEvmInjected,
  detectPhantomInjected,
  isMobile,
  openInMetaMaskDapp,
  openInPhantomDapp
} from "@/lib/wallets";

const chainLabel = (chain: string) => {
  if (chain === "evm") return "Ethereum (EVM)";
  if (chain === "solana") return "Solana";
  return chain;
};

type WalletRow = {
  id: string;
  chain: string;
  address: string;
  is_default: boolean;
  created_at: string;
};

type VerificationRow = {
  wallet_id: string;
  verified_at: string | null;
  created_at: string;
};

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<"evm" | "solana" | null>(null);

  const verifiedMap = useMemo(() => {
    const map = new Map<string, VerificationRow>();
    for (const row of verifications) {
      if (!map.has(row.wallet_id)) {
        map.set(row.wallet_id, row);
      }
    }
    return map;
  }, [verifications]);

  const withAuthFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = data.session?.access_token;
    if (!token) throw new Error("Missing session");
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`
      }
    });
  };

  const loadWallets = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: walletRows, error: walletError } = await supabase
        .from("wallets")
        .select("id,chain,address,is_default,created_at")
        .order("created_at", { ascending: false });
      if (walletError) throw walletError;
      const { data: verificationRows, error: verifyError } = await supabase
        .from("wallet_verifications")
        .select("wallet_id,verified_at,created_at")
        .order("created_at", { ascending: false });
      if (verifyError) throw verifyError;

      setWallets((walletRows ?? []) as WalletRow[]);
      setVerifications((verificationRows ?? []) as VerificationRow[]);
    } catch (err: any) {
      const message = err?.message ?? "Unable to load wallets";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNonce = async () => {
    const res = await withAuthFetch("/api/wallets/nonce");
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error ?? "Failed to get nonce");
    }
    return payload as { nonce: string; message: string };
  };

  const verifyWallet = async (chain: "evm" | "solana", address: string, signature: string, nonce: string, message: string) => {
    const res = await withAuthFetch("/api/wallets/verify", {
      method: "POST",
      body: JSON.stringify({ chain, address, signature, nonce, message })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error ?? "Verification failed");
    }
    return payload as { ok: true; wallet_id: string; verified_at: string };
  };

  const connectEvm = async () => {
    if (!detectEvmInjected()) {
      if (isMobile()) {
        toast.message("Open BA6 in the MetaMask in-app browser.");
        openInMetaMaskDapp();
      } else {
        toast.error("Install MetaMask or another EVM wallet.");
      }
      return;
    }
    setConnecting("evm");
    try {
      const result = await connectEvmInjected();
      const address = result?.address ?? "";
      const provider = result?.provider;
      if (!address) throw new Error("No wallet address returned");
      const { nonce, message } = await fetchNonce();
      if (!provider) throw new Error("Wallet provider unavailable");
      const signature = String(await provider.request({ method: "personal_sign", params: [message, address] }));
      await verifyWallet("evm", address, signature, nonce, message);
      toast.success("Wallet verified");
      await loadWallets();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to verify wallet");
    } finally {
      setConnecting(null);
    }
  };

  const connectSolana = async () => {
    if (!detectPhantomInjected()) {
      if (isMobile()) {
        toast.message("Open BA6 in the Phantom in-app browser.");
        openInPhantomDapp();
      } else {
        toast.error("Install Phantom or another Solana wallet.");
      }
      return;
    }
    setConnecting("solana");
    try {
      const result = await connectSolanaInjected();
      const address = result?.address ?? "";
      const provider = result?.provider;
      if (!address) throw new Error("No Solana address returned");
      const { nonce, message } = await fetchNonce();
      const encoded = new TextEncoder().encode(message);
      if (!provider) throw new Error("Wallet provider unavailable");
      const signed = await provider.signMessage(encoded, "utf8");
      const signatureBytes = signed instanceof Uint8Array ? signed : signed?.signature;
      if (!signatureBytes) throw new Error("Missing signature");
      const signature = bs58.encode(signatureBytes);
      await verifyWallet("solana", address, signature, nonce, message);
      toast.success("Wallet verified");
      await loadWallets();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to verify wallet");
    } finally {
      setConnecting(null);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  if (loading) return <LoadingState label="Loading wallets" />;
  if (error) return <ErrorState title="Wallets unavailable" subtitle={error} onRetry={loadWallets} />;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Wallets</div>
            <div className="text-sm text-black/60">Connect and verify wallets for future billing and identity.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadWallets} className="w-auto sm:hidden">
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Connect a wallet</div>
            <div className="text-xs text-black/50">Sign a verification message to prove ownership.</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" onClick={connectEvm} disabled={!!connecting} className="w-full sm:w-auto">
              {connecting === "evm" ? "Connecting..." : "Connect EVM"}
            </Button>
            <Button size="sm" variant="secondary" onClick={connectSolana} disabled={!!connecting} className="w-full sm:w-auto">
              {connecting === "solana" ? "Connecting..." : "Connect Solana"}
            </Button>
          </div>
        </div>
      </Card>

      {wallets.length === 0 ? (
        <EmptyState title="No wallets" subtitle="Connect a wallet to verify ownership." />
      ) : (
        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Linked wallets</div>
          <div className="mt-4 space-y-3 sm:hidden">
            {wallets.map((wallet) => {
              const verified = verifiedMap.get(wallet.id);
              return (
                <MobileCard
                  key={wallet.id}
                  title={`${chainLabel(wallet.chain)}${wallet.is_default ? " • Default" : ""}`}
                  subtitle={wallet.address}
                  status={
                    <span className={`text-xs font-semibold ${verified?.verified_at ? "text-emerald-600" : "text-black/40"}`}>
                      {verified?.verified_at ? "Verified" : "Unverified"}
                    </span>
                  }
                  details={
                    <div>
                      <div>Added: {new Date(wallet.created_at).toLocaleString()}</div>
                      <div>Verified: {verified?.verified_at ? new Date(verified.verified_at).toLocaleString() : "-"}</div>
                    </div>
                  }
                />
              );
            })}
          </div>

          <div className="mt-4 hidden divide-y divide-black/5 sm:block">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black/50">
              <div className="col-span-3">Chain</div>
              <div className="col-span-5">Address</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Default</div>
            </div>
            {wallets.map((wallet) => {
              const verified = verifiedMap.get(wallet.id);
              return (
                <div key={wallet.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-3 text-xs text-black/70">{chainLabel(wallet.chain)}</div>
                  <div className="col-span-5 text-xs text-black/60 break-all">{wallet.address}</div>
                  <div className="col-span-2 text-xs text-black/60">
                    {verified?.verified_at ? "Verified" : "Unverified"}
                  </div>
                  <div className="col-span-2 text-xs text-black/60">
                    {wallet.is_default ? "Default" : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
