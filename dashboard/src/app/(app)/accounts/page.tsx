"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { MobileCard } from "@/components/ui/MobileCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";
import { connectEthereum, connectSolana } from "@/lib/magic";
import { ensureUserAndWallet, fetchWallets, type WalletRow } from "@/lib/db";

type AccountRow = {
  id: string;
  account_did: string;
  handle: string | null;
  is_active: boolean;
  created_at: string;
  last_auth_at: string | null;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"handle" | "last_auth">("handle");
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);

  const resolveHandle = async (value: string) => {
    const res = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(value)}`
    );
    if (!res.ok) {
      throw new Error("Unable to resolve handle");
    }
    const payload = await res.json();
    if (!payload?.did) {
      throw new Error("Handle not found");
    }
    return String(payload.did);
  };

  const connectAccount = async () => {
    if (!handle.trim()) {
      toast.error("Handle is required");
      return;
    }
    if (!appPassword.trim()) {
      toast.error("App password is required");
      return;
    }
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Missing user session");

      const did = await resolveHandle(handle.trim());
      const makeActive = accounts.length === 0;
      const { data: secretId, error: secretError } = await supabase.rpc("create_account_secret", {
        secret: appPassword.trim(),
        name: `bsky:${handle.trim()}`,
        description: `Bluesky app password for ${handle.trim()}`
      });
      if (secretError) throw secretError;
      if (!secretId) throw new Error("Unable to store app password");

      const { error: insertError } = await supabase.from("accounts").insert({
        user_id: userId,
        account_did: did,
        handle: handle.trim(),
        vault_secret_id: secretId,
        is_active: makeActive
      });
      if (insertError) throw insertError;
      toast.success("Account connected");
      setHandle("");
      setAppPassword("");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to connect account");
    } finally {
      setSaving(false);
    }
  };

  const setActiveAccount = async (account: AccountRow) => {
    setSaving(true);
    try {
      if (account.is_active) {
        const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", account.id);
        if (error) throw error;
      } else {
        const { error: clearError } = await supabase.from("accounts").update({ is_active: false }).neq("id", account.id);
        if (clearError) throw clearError;
        const { error: setError } = await supabase.from("accounts").update({ is_active: true }).eq("id", account.id);
        if (setError) throw setError;
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  const disconnectAccount = async (account: AccountRow) => {
    if (!confirm(`Disconnect ${account.handle ?? account.account_did}?`)) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from("accounts").delete().eq("id", account.id);
      if (deleteError) throw deleteError;
      toast.success("Account disconnected");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to disconnect account");
    } finally {
      setSaving(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountRes, walletRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id,account_did,handle,is_active,created_at,last_auth_at")
          .order("created_at", { ascending: false }),
        fetchWallets()
      ]);
      if (accountRes.error) throw accountRes.error;
      setAccounts((accountRes.data ?? []) as AccountRow[]);
      if (!walletRes.ok) {
        throw new Error(walletRes.error);
      }
      setWallets(walletRes.wallets);
    } catch (err: any) {
      const message = err?.message ?? "Failed to load accounts";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    const term = search.toLowerCase();
    let filtered = accounts;
    if (term) {
      filtered = accounts.filter((account) => {
        return (
          (account.handle ?? "").toLowerCase().includes(term) ||
          account.account_did.toLowerCase().includes(term)
        );
      });
    }
    return [...filtered].sort((a, b) => {
      if (sortKey === "last_auth") {
        const aAuth = a.last_auth_at ?? "";
        const bAuth = b.last_auth_at ?? "";
        return bAuth.localeCompare(aAuth);
      }
      return (a.handle ?? a.account_did).localeCompare(b.handle ?? b.account_did);
    });
  }, [accounts, search, sortKey]);

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingState label="Loading accounts" />;
  if (error) return <ErrorState title="Accounts unavailable" subtitle={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Accounts</div>
            <div className="text-sm text-black/60">Linked Bluesky identities.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} className="w-auto sm:hidden">
            Refresh
          </Button>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Connect Bluesky account</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Handle</label>
            <Input
              placeholder="you.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">App password</label>
            <Input
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-black/50">
              Handle is used as the display name. Add labels in your notes if needed.
            </div>
          </div>
        </div>
        <Button onClick={connectAccount} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving..." : "Connect account"}
        </Button>
        <div className="text-xs text-black/50">
          App passwords are stored in Supabase Vault and only decrypted for authenticated services.
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Wallet identity (Magic)</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="w-full"
            disabled={walletSaving}
            onClick={async () => {
              const email = window.prompt("Enter your email for Magic");
              if (!email?.trim()) {
                toast.error("Email is required to connect Magic");
                return;
              }
              setWalletSaving(true);
              try {
                const wallet = await connectEthereum(email.trim());
                const linked = await ensureUserAndWallet({ ...wallet, setDefault: true });
                if (!linked.ok) throw new Error(linked.error);
                toast.success("Magic Ethereum connected");
                await loadData();
              } catch (err: any) {
                toast.error(err?.message ?? "Failed to connect Ethereum wallet");
              } finally {
                setWalletSaving(false);
              }
            }}
          >
            Connect Magic Ethereum
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={walletSaving}
            onClick={async () => {
              const email = window.prompt("Enter your email for Magic");
              if (!email?.trim()) {
                toast.error("Email is required to connect Magic");
                return;
              }
              setWalletSaving(true);
              try {
                const wallet = await connectSolana(email.trim());
                const linked = await ensureUserAndWallet({ ...wallet, setDefault: true });
                if (!linked.ok) throw new Error(linked.error);
                toast.success("Magic Solana connected");
                await loadData();
              } catch (err: any) {
                toast.error(err?.message ?? "Failed to connect Solana wallet");
              } finally {
                setWalletSaving(false);
              }
            }}
          >
            Connect Magic Solana
          </Button>
        </div>
        <div className="text-xs text-black/50">
          Magic wallets are linked to your user profile for future payments gating.
        </div>
      </Card>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search handles or DIDs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as "handle" | "last_auth")}
          className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm sm:max-w-[180px]"
        >
          <option value="handle">Sort: handle</option>
          <option value="last_auth">Sort: last auth</option>
        </select>
        <Button variant="ghost" size="sm" onClick={loadData} className="w-full sm:w-auto">
          Refresh
        </Button>
      </Card>

      {filteredAccounts.length === 0 ? (
        <EmptyState title="No accounts" subtitle="Connect a Bluesky account to see it here." />
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {filteredAccounts.map((account) => {
              const lastAuthAt = account.last_auth_at ? new Date(account.last_auth_at) : null;
              const isActive = account.is_active;
              return (
                <MobileCard
                  key={account.id}
                  title={account.handle ?? "Unnamed account"}
                  subtitle={account.account_did}
                  status={
                    <span className={`text-xs font-semibold ${isActive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  }
                  details={
                    <>
                      <div>Handle: {account.handle ?? "Unknown"}</div>
                      <div>Last auth: {lastAuthAt ? formatDistanceToNow(lastAuthAt, { addSuffix: true }) : "Never"}</div>
                      <div>Created: {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}</div>
                    </>
                  }
                  actions={
                    <details>
                      <summary
                        aria-label="More actions"
                        className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-black/10 bg-white/80 px-4 text-lg font-semibold text-black/60"
                      >
                        ⋯
                      </summary>
                      <div className="mt-2 grid gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => setActiveAccount(account)}
                          disabled={saving}
                        >
                          {account.is_active ? "Deactivate" : "Set active"}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="w-full"
                          onClick={() => disconnectAccount(account)}
                          disabled={saving}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </details>
                  }
                />
              );
            })}
          </div>

          <Card className="hidden sm:block">
            <div className="grid grid-cols-12 gap-2 border-b border-black/10 bg-sand/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black/50">
              <div className="col-span-4">Handle</div>
              <div className="col-span-4">DID</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Last auth</div>
            </div>
            <div className="divide-y divide-black/5">
              {filteredAccounts.map((account) => {
                const lastAuthAt = account.last_auth_at ? new Date(account.last_auth_at) : null;
                const isActive = account.is_active;
                return (
                <div key={account.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-4 font-semibold text-ink">
                      {account.handle ?? "Unnamed account"}
                  </div>
                    <div className="col-span-4 text-xs text-black/60 break-all">{account.account_did}</div>
                    <div className={`col-span-2 text-xs ${isActive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isActive ? "Active" : "Inactive"}
                    </div>
                    <div className="col-span-2 text-xs text-black/60">
                      {lastAuthAt ? formatDistanceToNow(lastAuthAt, { addSuffix: true }) : "Never"}
                    </div>
                    <div className="col-span-12 flex flex-wrap gap-2 pt-2 text-xs text-black/60">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveAccount(account)}
                        disabled={saving}
                      >
                        {account.is_active ? "Deactivate" : "Set active"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => disconnectAccount(account)}
                        disabled={saving}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {wallets.length === 0 ? (
        <EmptyState title="No wallets" subtitle="Connect a Magic wallet to link your identity." />
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {wallets.map((wallet) => (
              <MobileCard
                key={wallet.id}
                title={`${wallet.chain} (${wallet.provider})`}
                subtitle={wallet.address}
                status={
                  <span className={`text-xs font-semibold ${wallet.is_default ? "text-emerald-600" : "text-black/40"}`}>
                    {wallet.is_default ? "Default" : "Linked"}
                  </span>
                }
                details={
                  <>
                    <div>Network: {wallet.network ?? "unknown"}</div>
                    <div>Verified: {wallet.is_verified ? "Yes" : "No"}</div>
                  </>
                }
              />
            ))}
          </div>

          <Card className="hidden sm:block">
            <div className="grid grid-cols-12 gap-2 border-b border-black/10 bg-sand/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black/50">
              <div className="col-span-3">Chain</div>
              <div className="col-span-5">Address</div>
              <div className="col-span-2">Default</div>
              <div className="col-span-2">Network</div>
            </div>
            <div className="divide-y divide-black/5">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-3 font-semibold text-ink capitalize">
                    {wallet.chain} ({wallet.provider})
                  </div>
                  <div className="col-span-5 text-xs text-black/60 break-all">{wallet.address}</div>
                  <div className="col-span-2 text-xs text-black/60">
                    {wallet.is_default ? "Default" : "Linked"}
                  </div>
                  <div className="col-span-2 text-xs text-black/60">{wallet.network ?? "-"}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
