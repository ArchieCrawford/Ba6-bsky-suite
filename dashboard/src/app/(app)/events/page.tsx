"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

type EventRow = {
  event_type: string;
  detail: any;
  created_at: string;
  scheduled_post_id: string | null;
};

const eventTypes = [
  "all",
  "claimed",
  "post_attempt",
  "post_success",
  "post_failed",
  "missing_account",
  "worker_error",
  "posting",
  "posted",
  "failed"
];

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventType, setEventType] = useState("all");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("post_events")
        .select("event_type,detail,created_at,scheduled_post_id")
        .order("created_at", { ascending: sortDir === "asc" })
        .limit(200);

      if (eventType !== "all") {
        query = query.eq("event_type", eventType);
      }

      const { data, error: eventError } = await query;
      if (eventError) throw eventError;
      setEvents((data ?? []) as EventRow[]);
    } catch (err: any) {
      const message = err?.message ?? "Failed to load events";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return events;
    return events.filter((event) => {
      const detail = JSON.stringify(event.detail ?? {});
      return (
        event.scheduled_post_id?.includes(term) ||
        event.event_type.toLowerCase().includes(term) ||
        detail.toLowerCase().includes(term)
      );
    });
  }, [events, search]);

  useEffect(() => {
    loadEvents();
  }, [eventType, sortDir]);

  if (loading) return <LoadingState label="Loading events" />;
  if (error) return <ErrorState title="Events unavailable" subtitle={error} onRetry={loadEvents} />;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Events</div>
            <div className="text-sm text-black/60">Audit trail for worker activity.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadEvents} className="w-auto sm:hidden">
            Refresh
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm sm:max-w-[200px]"
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
          className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm sm:max-w-[180px]"
        >
          <option value="desc">Sort: newest</option>
          <option value="asc">Sort: oldest</option>
        </select>
        <Input
          placeholder="Search by ID, type, or error"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Button variant="ghost" size="sm" onClick={loadEvents} className="w-full sm:w-auto">
          Refresh
        </Button>
      </Card>

      {filteredEvents.length === 0 ? (
        <EmptyState title="No events" subtitle="Event logs will appear here." />
      ) : (
        <Card className="space-y-3">
          {filteredEvents.map((event, index) => {
            const isError = String(event.event_type).includes("failed") || String(event.event_type).includes("error");
            return (
              <div
                key={`${event.created_at}-${index}`}
                className={`rounded-xl border px-4 py-3 ${
                  isError ? "border-rose-200 bg-rose-50" : "border-black/10 bg-white/80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/50">
                  <span className="uppercase tracking-wide">{event.event_type}</span>
                  <span>{format(new Date(event.created_at), "MMM d, HH:mm:ss")}</span>
                </div>
                <div className="mt-2 text-xs text-black/60 break-all">{event.scheduled_post_id}</div>
                {event.detail?.error_message && (
                  <div className="mt-2 text-xs text-rose-600">{event.detail.error_message}</div>
                )}
                <details className="mt-2 text-xs text-black/50">
                  <summary className="cursor-pointer uppercase tracking-wide">Detail</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(event.detail ?? {}, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
