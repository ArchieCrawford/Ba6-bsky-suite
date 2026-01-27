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

type HeartbeatRow = {
  worker_id: string;
  last_seen_at: string;
  detail: any;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [heartbeats, setHeartbeats] = useState<HeartbeatRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const statusCards = useMemo(
    () => STATUSES.map((status) => ({ status, count: statusCounts[status] ?? 0 })),
    [statusCounts]
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: scheduled, error: scheduledError } = await supabase
        .from("scheduled_posts")
        .select("status");
      if (scheduledError) throw scheduledError;

      const counts = (scheduled ?? []).reduce<Record<string, number>>((acc, row: any) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {});
      setStatusCounts(counts);

      const { data: failedEvents, error: failedError } = await supabase
        .from("post_events")
        .select("event_type,detail,created_at,scheduled_post_id")
        .in("event_type", ["post_failed", "worker_error", "failed"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (failedError) throw failedError;
      setEvents((failedEvents ?? []) as EventRow[]);

      const { data: heartbeatRows, error: heartbeatError } = await supabase
        .from("worker_heartbeats")
        .select("worker_id,last_seen_at,detail")
        .order("last_seen_at", { ascending: false })
        .limit(5);
      if (heartbeatError) throw heartbeatError;
      setHeartbeats((heartbeatRows ?? []) as HeartbeatRow[]);
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
            <div className="text-sm text-black/60">Live status across workers and queues.</div>
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
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Worker heartbeat</div>
          <div className="mt-4 space-y-3">
            {heartbeats.length === 0 && <div className="text-sm text-black/50">No heartbeats yet.</div>}
            {heartbeats.map((hb) => (
              <div key={hb.worker_id} className="flex items-center justify-between rounded-xl border border-black/10 bg-white/70 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{hb.worker_id}</div>
                  <div className="text-xs text-black/50">PID {hb.detail?.pid ?? "-"}</div>
                  {hb.detail?.claimed_count !== undefined && (
                    <div className="text-xs text-black/50">Claimed {hb.detail.claimed_count}</div>
                  )}
                  {hb.detail?.last_error && (
                    <div className="text-xs text-rose-600">Last error: {hb.detail.last_error}</div>
                  )}
                </div>
                <div className="text-xs text-black/60">
                  Seen {formatDistanceToNow(new Date(hb.last_seen_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Last failed events</div>
          <div className="mt-4 space-y-3">
            {events.length === 0 && <div className="text-sm text-black/50">No failures logged.</div>}
            {events.map((event, index) => (
              <div key={`${event.created_at}-${index}`} className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-rose-600">{event.event_type}</div>
                <div className="mt-1 text-sm text-rose-700">
                  {event.detail?.error_message ?? event.detail?.error ?? "Unknown error"}
                </div>
                <div className="mt-2 text-xs text-rose-600">
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
