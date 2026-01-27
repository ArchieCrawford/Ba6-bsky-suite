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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"handle" | "last_auth">("handle");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: accountRows, error: accountError } = await supabase
        .from("accounts")
        .select("id,account_did,handle,is_active,created_at,last_auth_at")
        .order("created_at", { ascending: false });
      if (accountError) throw accountError;
      setAccounts((accountRows ?? []) as AccountRow[]);
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
                      <div>Last auth: {lastAuthAt ? formatDistanceToNow(lastAuthAt, { addSuffix: true }) : "Never"}</div>
                      <div>Created: {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}</div>
                    </>
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
                  <div key={account.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
                    <div className="col-span-4 font-semibold text-ink">{account.handle ?? "Unnamed account"}</div>
                    <div className="col-span-4 text-xs text-black/60 break-all">{account.account_did}</div>
                    <div className={`col-span-2 text-xs ${isActive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isActive ? "Active" : "Inactive"}
                    </div>
                    <div className="col-span-2 text-xs text-black/60">
                      {lastAuthAt ? formatDistanceToNow(lastAuthAt, { addSuffix: true }) : "Never"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
