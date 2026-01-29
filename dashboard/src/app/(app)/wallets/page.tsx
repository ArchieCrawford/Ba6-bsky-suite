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
  connectWalletConnectEvm,
  detectEvmInjected,
  detectPhantomInjected,
  getAppHost,
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
  const mobile = useMemo(() => isMobile(), []);
  const host = useMemo(() => getAppHost(), []);
  const evmInjected = useMemo(() => detectEvmInjected().ok, []);
  const solInjected = useMemo(() => detectPhantomInjected().ok, []);

  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<null | "evm" | "solana" | "wc">(null);

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

  const verifyWallet = async (
    chain: "evm" | "solana",
    address: string,
    signature: string,
    nonce: string,
    message: string
  ) => {
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

  const phaseAConnectAndVerifyEvm = async () => {
    setConnecting("evm");
    try {
      const res = await connectEvmInjected();
      if (!res.ok) {
        if (mobile) {
          toast.message("Mobile browsers can’t see wallets. Open BA6 inside MetaMask, or use WalletConnect.");
          return;
        }
        toast.error(res.reason === "no_injected_provider" ? "MetaMask not detected in this browser." : "No EVM account.");
        return;
      }

      const { nonce, message } = await fetchNonce();
      const ethereum = (window as any)?.ethereum;
      if (!ethereum?.request) throw new Error("EVM provider not available");

      const signature = await ethereum.request({ method: "personal_sign", params: [message, res.address] });
      await verifyWallet("evm", res.address, signature, nonce, message);

      toast.success("Wallet verified");
      await loadWallets();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to verify wallet");
    } finally {
      setConnecting(null);
    }
  };

  const phaseAConnectAndVerifySolana = async () => {
    setConnecting("solana");
    try {
      const res = await connectSolanaInjected();
      if (!res.ok) {
        if (mobile) {
          toast.message("Mobile browsers can’t see wallets. Open BA6 inside Phantom.");
          return;
        }
        toast.error(res.reason === "no_injected_provider" ? "Phantom not detected in this browser." : "No Solana account.");
        return;
      }

      const { nonce, message } = await fetchNonce();
      const solana = (window as any)?.solana;
      if (!solana?.signMessage) throw new Error("Solana signMessage not available");

      const encoded = new TextEncoder().encode(message);
      const signed = await solana.signMessage(encoded, "utf8");
      const signatureBytes = signed?.signature ?? signed;
      const signature = bs58.encode(signatureBytes);

      await verifyWallet("solana", res.address, signature, nonce, message);

      toast.success("Wallet verified");
      await loadWallets();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to verify wallet");
    } finally {
      setConnecting(null);
    }
  };

  const connectWc = async () => {
    setConnecting("wc");
    try {
      const res = await connectWalletConnectEvm();
      if (!res.ok) {
        toast.message("WalletConnect is not configured yet (coming next).");
        return;
      }
      toast.success("Connected via WalletConnect");
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

      {mobile && (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Mobile wallet mode</div>
              <div className="text-xs text-black/50">
                iPhone/Android browsers usually can’t see wallets. Open BA6 inside the wallet app browser.
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" variant="secondary" onClick={() => openInMetaMaskDapp(host)} className="w-full sm:w-auto">
                Open in MetaMask
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openInPhantomDapp(host)} className="w-full sm:w-auto">
                Open in Phantom
              </Button>
              <Button size="sm" onClick={connectWc} disabled={connecting === "wc"} className="w-full sm:w-auto">
                {connecting === "wc" ? "Connecting..." : "WalletConnect (EVM)"}
              </Button>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-black/10 bg-white/70 p-3 text-xs text-black/60">
            After you open BA6 inside MetaMask/Phantom, come back here and tap “Verify” to sign the message.
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Verify a wallet</div>
            <div className="text-xs text-black/50">Sign a verification message to prove ownership.</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              onClick={phaseAConnectAndVerifyEvm}
              disabled={!!connecting || (mobile && !evmInjected)}
              className="w-full sm:w-auto"
            >
              {connecting === "evm" ? "Verifying..." : mobile ? "Verify EVM (in MetaMask)" : evmInjected ? "Verify MetaMask (EVM)" : "Verify EVM"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={phaseAConnectAndVerifySolana}
              disabled={!!connecting || (mobile && !solInjected)}
              className="w-full sm:w-auto"
            >
              {connecting === "solana"
                ? "Verifying..."
                : mobile
                  ? "Verify Solana (in Phantom)"
                  : solInjected
                    ? "Verify Phantom (Solana)"
                    : "Verify Solana"}
            </Button>
          </div>
        </div>

        {mobile && !evmInjected && !solInjected && (
          <div className="mt-3 rounded-xl border border-black/10 bg-white/70 p-3 text-xs text-black/60">
            Wallet not detected in this browser. That’s normal on mobile. Use “Open in MetaMask/Phantom” above, then verify.
          </div>
        )}

        {!mobile && !evmInjected && !solInjected && (
          <div className="mt-3 rounded-xl border border-black/10 bg-white/70 p-3 text-xs text-black/60">
            No injected wallets detected. Install MetaMask/Phantom extensions (desktop), or use wallet in-app browser on mobile.
          </div>
        )}
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
                  <div className="col-span-2 text-xs text-black/60">{verified?.verified_at ? "Verified" : "Unverified"}</div>
                  <div className="col-span-2 text-xs text-black/60">{wallet.is_default ? "Default" : "-"}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
