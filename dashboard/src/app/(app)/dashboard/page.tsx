"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "sonner";

const STATUSES = ["queued", "posting", "posted", "failed", "canceled"] as const;

type EventRow = {
  event_type: string;
  detail: any;
  created_at: string;
  scheduled_post_id: string | null;
};

type AccountRow = {
  id: string;
  account_did: string;
  handle: string | null;
  is_active: boolean;
};

type WalletRow = {
  id: string;
  provider: string;
  chain: string;
  address: string;
  is_default: boolean;
};

type FeedRow = {
  id: string;
  slug: string;
  title: string | null;
  is_enabled: boolean;
};

type UpcomingAction = {
  id: string;
  type: "Post" | "Feed Refresh" | "Rule Evaluation";
  target: string;
  run_at: string;
};

type ActivitySummary = {
  postsPublished: number;
  feedsRefreshed: number;
  draftsSaved: number;
  failures: number;
};

const STATUS_COPY: Record<string, { label: string; description: string }> = {
  operational: {
    label: "Operational",
    description: "All scheduled tasks are processing normally."
  },
  degraded: {
    label: "Degraded",
    description: "Some tasks may be delayed. Check Events for details."
  },
  paused: {
    label: "Paused",
    description: "Scheduling is paused. No tasks will run until resumed."
  }
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAction[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    postsPublished: 0,
    feedsRefreshed: 0,
    draftsSaved: 0,
    failures: 0
  });
  const [recentEvents, setRecentEvents] = useState<EventRow[]>([]);

  const statusCards = useMemo(
    () => STATUSES.map((status) => ({ status, count: statusCounts[status] ?? 0 })),
    [statusCounts]
  );

  const executionStatus = useMemo(() => {
    if (summary.failures > 0) return "degraded";
    if (accounts.length === 0) return "paused";
    return "operational";
  }, [summary.failures, accounts.length]);

  const connectedChips = useMemo(() => {
    const bluesky = accounts.length > 0;
    const solana = wallets.some((wallet) => wallet.chain === "solana");
    const ethereum = wallets.some((wallet) => wallet.chain === "evm" || wallet.chain === "ethereum");
    const magic = wallets.some((wallet) => wallet.provider === "magic");
    return [
      { label: "Bluesky", connected: bluesky },
      { label: "Solana", connected: solana },
      { label: "Ethereum", connected: ethereum },
      { label: "Magic", connected: magic }
    ];
  }, [accounts, wallets]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [
        scheduledRes,
        upcomingRes,
        eventRes,
        accountRes,
        walletRes,
        feedRes,
        draftCountRes
      ] = await Promise.all([
        supabase.from("scheduled_posts").select("status"),
        supabase
          .from("scheduled_posts")
          .select("id,run_at,account_did")
          .eq("status", "queued")
          .gt("run_at", now.toISOString())
          .order("run_at", { ascending: true })
          .limit(5),
        supabase
          .from("post_events")
          .select("event_type,detail,created_at,scheduled_post_id")
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("accounts").select("id,account_did,handle,is_active"),
        supabase.from("wallets").select("id,provider,chain,address,is_default"),
        supabase.from("feeds").select("id,slug,title,is_enabled"),
        supabase
          .from("drafts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", last24h)
      ]);

      if (scheduledRes.error) throw scheduledRes.error;
      if (upcomingRes.error) throw upcomingRes.error;
      if (eventRes.error) throw eventRes.error;
      if (accountRes.error) throw accountRes.error;
      if (walletRes.error) throw walletRes.error;
      if (feedRes.error) throw feedRes.error;
      if (draftCountRes.error) throw draftCountRes.error;

      const counts = (scheduledRes.data ?? []).reduce<Record<string, number>>((acc, row: any) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {});
      setStatusCounts(counts);

      const accountRows = (accountRes.data ?? []) as AccountRow[];
      setAccounts(accountRows);
      setWallets((walletRes.data ?? []) as WalletRow[]);
      setFeeds((feedRes.data ?? []) as FeedRow[]);

      const accountMap = new Map(accountRows.map((account) => [account.account_did, account.handle]));
      const upcomingItems = (upcomingRes.data ?? []).map((row: any) => {
        const handle = row.account_did ? accountMap.get(row.account_did) : null;
        return {
          id: row.id,
          type: "Post" as const,
          target: handle ? `@${handle}` : "Connected account",
          run_at: row.run_at
        };
      });
      setUpcoming(upcomingItems);

      const rawEvents = (eventRes.data ?? []) as EventRow[];
      const userEvents = rawEvents.filter((event) => {
        const type = event.event_type.toLowerCase();
        return !type.includes("worker") && !type.includes("schema") && !type.includes("stack");
      });
      setRecentEvents(userEvents.slice(0, 5));

      const postsPublished = userEvents.filter((event) => {
        const type = event.event_type.toLowerCase();
        return (type.includes("post") || type.includes("published")) && (type.includes("success") || type.includes("posted"));
      }).length;
      const feedsRefreshed = userEvents.filter((event) => {
        const type = event.event_type.toLowerCase();
        return type.includes("feed") && (type.includes("refresh") || type.includes("update"));
      }).length;
      const failures = userEvents.filter((event) => {
        const type = event.event_type.toLowerCase();
        return type.includes("fail") || type.includes("error");
      }).length;

      setSummary({
        postsPublished,
        feedsRefreshed,
        draftsSaved: draftCountRes.count ?? 0,
        failures
      });
    } catch (err: any) {
      const message = err?.message ?? "Failed to load dashboard data";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingState label="Loading overview" />;
  }

  if (error) {
    return <ErrorState title="Dashboard unavailable" subtitle={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Overview</div>
            <div className="text-sm text-black/60">Monitor your automated queue at a glance.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} className="w-auto">
            Refresh
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statusCards.map((item) => (
          <Card key={item.status} className="flex flex-col gap-3">
            <StatusBadge status={item.status} />
            <div className="text-3xl font-semibold text-ink">{item.count}</div>
            <div className="text-xs uppercase tracking-wide text-black/50">Scheduled posts</div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Execution Status</div>
          <div className="mt-4">
            <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black/70">
              {STATUS_COPY[executionStatus].label}
            </span>
            <div className="mt-2 text-sm text-black/60">{STATUS_COPY[executionStatus].description}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {connectedChips.map((chip) => (
                <span
                  key={chip.label}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    chip.connected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-black/10 bg-black/5 text-black/50"
                  }`}
                >
                  {chip.label}: {chip.connected ? "Connected" : "Not connected"}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Upcoming Actions</div>
          <div className="mt-4 space-y-3">
            {upcoming.length === 0 && (
              <div className="text-sm text-black/50">No upcoming actions. You&apos;re fully caught up.</div>
            )}
            {upcoming.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-black/10 bg-white/70 px-4 py-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-black/40">{item.type}</div>
                  <div className="text-sm font-semibold text-ink">{item.target}</div>
                </div>
                <div className="text-xs text-black/60">
                  {formatDistanceToNow(new Date(item.run_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-black/50">
                Recent Activity (24h)
              </div>
              <div className="text-xs text-black/50">Summary of user-facing actions.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/events")} className="w-auto">
              View Events
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Posts published</div>
              <div className="text-2xl font-semibold text-ink">{summary.postsPublished}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Feeds refreshed</div>
              <div className="text-2xl font-semibold text-ink">{summary.feedsRefreshed}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Drafts saved</div>
              <div className="text-2xl font-semibold text-ink">{summary.draftsSaved}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Failures</div>
              <div className="text-2xl font-semibold text-ink">{summary.failures}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {recentEvents.length === 0 && <div className="text-sm text-black/50">No recent activity.</div>}
            {recentEvents.map((event, index) => {
              const type = event.event_type.toLowerCase();
              let label = event.event_type.replace(/_/g, " ");
              if (type.includes("post") && (type.includes("success") || type.includes("posted"))) {
                const handle = event.detail?.handle ?? event.detail?.account_handle ?? "";
                label = handle ? `Posted to ${handle}` : "Post published";
              } else if (type.includes("post") && type.includes("fail")) {
                label = "Post failed";
              } else if (type.includes("feed") && (type.includes("refresh") || type.includes("update"))) {
                const feedName = event.detail?.feed ?? event.detail?.feed_slug ?? event.detail?.slug ?? "feed";
                label = `Feed refreshed: ${feedName}`;
              } else if (type.includes("draft")) {
                label = "Draft saved";
              }

              return (
                <div key={`${event.created_at}-${index}`} className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
                  <div className="text-sm font-semibold text-ink">{label}</div>
                  <div className="text-xs text-black/50">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Automation Coverage</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Bluesky accounts</div>
              <div className="text-2xl font-semibold text-ink">{accounts.length}</div>
              <div className="text-xs text-black/50">
                {accounts.length === 0 ? "Connect an account to post." : "Connected and ready."}
              </div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Feeds enabled</div>
              <div className="text-2xl font-semibold text-ink">
                {feeds.filter((feed) => feed.is_enabled).length}
              </div>
              <div className="text-xs text-black/50">
                {feeds.length > 0 ? `${feeds.length} total feeds` : "Create a feed to start."}
              </div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Queued actions</div>
              <div className="text-2xl font-semibold text-ink">{statusCounts.queued ?? 0}</div>
              <div className="text-xs text-black/50">Scheduled posts waiting to run.</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase text-black/40">Wallets linked</div>
              <div className="text-2xl font-semibold text-ink">{wallets.length}</div>
              <div className="text-xs text-black/50">
                {wallets.length === 0 ? "Optional for payments and identity." : "Ready for future billing."}
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
