"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

type AccountRow = {
  did: string;
  handle: string;
  service: string;
  created_at: string;
};

type SessionRow = {
  account_did: string;
  expires_at: string;
  updated_at: string;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"handle" | "expiry">("handle");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: accountRows, error: accountError } = await supabase
        .from("bsky_accounts")
        .select("did,handle,service,created_at")
        .order("created_at", { ascending: false });
      if (accountError) throw accountError;
      setAccounts((accountRows ?? []) as AccountRow[]);

      const { data: sessionRows, error: sessionError } = await supabase
        .from("bsky_sessions")
        .select("account_did,expires_at,updated_at")
        .order("updated_at", { ascending: false });
      if (sessionError) throw sessionError;
      setSessions((sessionRows ?? []) as SessionRow[]);
    } catch (err: any) {
      const message = err?.message ?? "Failed to load accounts";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const sessionMap = useMemo(() => {
    return sessions.reduce<Record<string, SessionRow>>((acc, row) => {
      acc[row.account_did] = row;
      return acc;
    }, {});
  }, [sessions]);

  const filteredAccounts = useMemo(() => {
    const term = search.toLowerCase();
    let filtered = accounts;
    if (term) {
      filtered = accounts.filter((account) => {
        return account.handle.toLowerCase().includes(term) || account.did.toLowerCase().includes(term);
      });
    }
    return [...filtered].sort((a, b) => {
      if (sortKey === "expiry") {
        const aExpiry = sessionMap[a.did]?.expires_at ?? "";
        const bExpiry = sessionMap[b.did]?.expires_at ?? "";
        return bExpiry.localeCompare(aExpiry);
      }
      return a.handle.localeCompare(b.handle);
    });
  }, [accounts, search, sortKey, sessionMap]);

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingState label="Loading accounts" />;
  if (error) return <ErrorState title="Accounts unavailable" subtitle={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search handles or DIDs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as "handle" | "expiry")} className="max-w-[160px]">
          <option value="handle">Sort: handle</option>
          <option value="expiry">Sort: expiry</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={loadData}>
          Refresh
        </Button>
      </Card>

      {filteredAccounts.length === 0 ? (
        <EmptyState title="No accounts" subtitle="Connect a Bluesky account to see it here." />
      ) : (
        <Card>
          <div className="grid grid-cols-12 gap-2 border-b border-black/10 bg-sand/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black/50">
            <div className="col-span-4">Handle</div>
            <div className="col-span-4">DID</div>
            <div className="col-span-2">Session</div>
            <div className="col-span-2">Expiry</div>
          </div>
          <div className="divide-y divide-black/5">
            {filteredAccounts.map((account) => {
              const session = sessionMap[account.did];
              const expiresAt = session ? new Date(session.expires_at) : null;
              const expired = expiresAt ? expiresAt.getTime() < Date.now() : true;
              return (
                <div key={account.did} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
                  <div className="col-span-4 font-semibold text-ink">{account.handle}</div>
                  <div className="col-span-4 text-xs text-black/60 break-all">{account.did}</div>
                  <div className={`col-span-2 text-xs ${expired ? "text-rose-600" : "text-emerald-600"}`}>
                    {expired ? "Expired" : "Active"}
                  </div>
                  <div className="col-span-2 text-xs text-black/60">
                    {expiresAt ? formatDistanceToNow(expiresAt, { addSuffix: true }) : "-"}
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
