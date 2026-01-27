"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MobileCard } from "@/components/ui/MobileCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

const statusOptions = ["all", "queued", "posting", "posted", "failed", "canceled"];
const workerSettings = [
  { label: "WORKER_POLL_MS", value: process.env.NEXT_PUBLIC_WORKER_POLL_MS },
  { label: "WORKER_LOCK_SECONDS", value: process.env.NEXT_PUBLIC_WORKER_LOCK_SECONDS },
  { label: "WORKER_ERROR_BACKOFF_MS", value: process.env.NEXT_PUBLIC_WORKER_ERROR_BACKOFF_MS }
];
const formatWorkerSetting = (value?: string) => (value === undefined || value === "" ? "configured in worker env" : value);

type ScheduledRow = {
  id: string;
  status: string;
  run_at: string;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  posted_uri: string | null;
  posted_cid: string | null;
  locked_at: string | null;
  locked_by: string | null;
  account_did: string | null;
  drafts?: { text: string | null }[] | { text: string | null } | null;
};

type EventRow = {
  event_type: string;
  detail: any;
  created_at: string;
};

export default function ScheduledPage() {
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"run_at" | "status">("run_at");
  const [selected, setSelected] = useState<ScheduledRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  const loadScheduled = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: scheduledError } = await supabase
        .from("scheduled_posts")
        .select("id,status,run_at,attempt_count,max_attempts,last_error,posted_uri,posted_cid,locked_at,locked_by,account_did,drafts(text)")
        .order("run_at", { ascending: false });
      if (scheduledError) throw scheduledError;
      setRows((data ?? []) as ScheduledRow[]);
    } catch (err: any) {
      const message = err?.message ?? "Failed to load scheduled posts";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (scheduledId: string) => {
    try {
      const { data, error: eventError } = await supabase
        .from("post_events")
        .select("event_type,detail,created_at")
        .eq("scheduled_post_id", scheduledId)
        .order("created_at", { ascending: true });
      if (eventError) throw eventError;
      setEvents((data ?? []) as EventRow[]);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load events");
    }
  };

  const retryJob = async (row: ScheduledRow) => {
    if (!confirm("Retry this job now?")) return;
    try {
      const { error: updateError } = await supabase
        .from("scheduled_posts")
        .update({
          status: "queued",
          locked_at: null,
          locked_by: null,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      toast.success("Job queued");
      await loadScheduled();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to retry");
    }
  };

  const cancelJob = async (row: ScheduledRow) => {
    if (!confirm("Cancel this job?")) return;
    try {
      const { error: updateError } = await supabase
        .from("scheduled_posts")
        .update({ status: "canceled", locked_at: null, locked_by: null, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updateError) throw updateError;
      toast.success("Job canceled");
      await loadScheduled();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to cancel");
    }
  };

  const filteredRows = useMemo(() => {
    const term = search.toLowerCase();
    let filtered = rows;
    if (statusFilter !== "all") {
      filtered = filtered.filter((row) => row.status === statusFilter);
    }
    if (term) {
      filtered = filtered.filter((row) => {
        const text = Array.isArray(row.drafts) ? row.drafts[0]?.text ?? "" : row.drafts?.text ?? "";
        return text.toLowerCase().includes(term) || row.id.includes(term);
      });
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "status") {
        return a.status.localeCompare(b.status);
      }
      return new Date(b.run_at).getTime() - new Date(a.run_at).getTime();
    });
    return sorted;
  }, [rows, search, statusFilter, sortKey]);

  useEffect(() => {
    loadScheduled();
  }, []);

  useEffect(() => {
    if (selected) {
      loadEvents(selected.id);
    } else {
      setEvents([]);
    }
  }, [selected]);

  if (loading) return <LoadingState label="Loading scheduled posts" />;
  if (error) return <ErrorState title="Failed to load" subtitle={error} onRetry={loadScheduled} />;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Scheduled</div>
            <div className="text-sm text-black/60">Monitor queued and posted work.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadScheduled} className="w-auto sm:hidden">
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold uppercase tracking-wide text-black/60">
            How scheduling works
          </summary>
          <div className="mt-3 space-y-3 text-sm text-black/70">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-black/80">scheduled_posts</span> rows are the source of truth for each scheduled job.
              </li>
              <li>Status moves from queued to posting, then posted, failed, or canceled as the worker updates each row.</li>
              <li>The worker uses an atomic claim RPC to set the lock fields so only one worker can post at a time.</li>
              <li>
                Retries increment attempt_count with backoff, and every claim, attempt, or error is recorded in the post_events
                timeline.
              </li>
            </ul>
            <div className="rounded-xl border border-black/10 bg-white/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Key settings</div>
              <dl className="mt-3 grid gap-3 text-xs text-black/60 sm:grid-cols-3">
                {workerSettings.map((setting) => (
                  <div key={setting.label}>
                    <dt className="font-semibold text-black/60">{setting.label}</dt>
                    <dd className="mt-1 text-black/80">{formatWorkerSetting(setting.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </details>
      </Card>
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search drafts or IDs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm sm:max-w-[180px]"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as "run_at" | "status")}
          className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm sm:max-w-[180px]"
        >
          <option value="run_at">Sort: Run time</option>
          <option value="status">Sort: Status</option>
        </select>
        <Button variant="ghost" size="sm" onClick={loadScheduled} className="w-full sm:w-auto">
          Refresh
        </Button>
      </Card>

      {filteredRows.length === 0 ? (
        <EmptyState title="No scheduled posts" subtitle="Create a draft and schedule it to see entries here." />
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {filteredRows.map((row) => {
              const draftText = Array.isArray(row.drafts)
                ? row.drafts[0]?.text ?? "(missing draft)"
                : row.drafts?.text ?? "(missing draft)";
              return (
                <MobileCard
                  key={row.id}
                  title={draftText.split("\n")[0]?.slice(0, 80) || "Scheduled post"}
                  subtitle={format(new Date(row.run_at), "MMM d, yyyy HH:mm")}
                  status={<StatusBadge status={row.status} />}
                  details={
                    <>
                      <div className="whitespace-pre-line text-black/70">{draftText}</div>
                      <div className="break-all">Account: {row.account_did ?? "No account connected"}</div>
                      <div>
                        Attempts: {row.attempt_count}/{row.max_attempts}
                      </div>
                      <div className="break-all">Posted URI: {row.posted_uri ?? "-"}</div>
                      <div className="break-all">Last error: {row.last_error ?? "None"}</div>
                    </>
                  }
                  actions={
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => setSelected(row)}>
                      View timeline
                    </Button>
                  }
                />
              );
            })}
          </div>

          <Card className="hidden sm:block overflow-hidden">
            <div className="grid grid-cols-12 gap-2 border-b border-black/10 bg-sand/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black/50">
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Run at</div>
              <div className="col-span-5">Draft</div>
              <div className="col-span-2">Attempts</div>
            </div>
            <div className="divide-y divide-black/5">
              {filteredRows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="grid w-full grid-cols-12 gap-2 px-4 py-3 text-left text-sm hover:bg-black/5"
                >
                  <div className="col-span-2">
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="col-span-3 text-xs text-black/60">
                    {format(new Date(row.run_at), "MMM d, yyyy HH:mm")}
                  </div>
                  <div className="col-span-5 text-sm text-black/80">
                    {Array.isArray(row.drafts) ? row.drafts[0]?.text ?? "(missing draft)" : row.drafts?.text ?? "(missing draft)"}
                  </div>
                  <div className="col-span-2 text-xs text-black/60">
                    {row.attempt_count}/{row.max_attempts}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Scheduled post ${selected.id.slice(0, 8)}` : ""}
      >
        {selected && (
          <div className="space-y-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">Draft</div>
              <div className="mt-2 whitespace-pre-line rounded-xl border border-black/10 bg-white/70 p-4">
                {Array.isArray(selected.drafts)
                  ? selected.drafts[0]?.text ?? "No draft text"
                  : selected.drafts?.text ?? "No draft text"}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-black/40">Attempts</div>
                <div className="mt-1 text-sm font-semibold">
                  {selected.attempt_count}/{selected.max_attempts}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-black/40">Account DID</div>
                <div className="mt-1 text-xs text-black/70 break-all">
                  {selected.account_did ?? "No account connected"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">Posted URI / CID</div>
              <div className="mt-1 text-xs text-black/70 break-all">
                {selected.posted_uri ?? "-"}
              </div>
              <div className="mt-1 text-xs text-black/50 break-all">
                {selected.posted_cid ?? "-"}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">Last error</div>
              <div className="mt-1 text-xs text-rose-600 break-words">
                {selected.last_error ?? "None"}
              </div>
            </div>

            <div className="hidden flex-wrap gap-2 sm:flex">
              <Button variant="secondary" size="sm" onClick={() => retryJob(selected)}>
                Retry job
              </Button>
              <Button variant="danger" size="sm" onClick={() => cancelJob(selected)}>
                Cancel job
              </Button>
            </div>

            <details className="sm:hidden">
              <summary
                aria-label="More actions"
                className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-black/10 bg-white/80 px-4 text-lg font-semibold text-black/60"
              >
                ⋯
              </summary>
              <div className="mt-3 grid gap-2">
                <Button variant="secondary" size="sm" onClick={() => retryJob(selected)} className="w-full">
                  Retry job
                </Button>
                <Button variant="danger" size="sm" onClick={() => cancelJob(selected)} className="w-full">
                  Cancel job
                </Button>
              </div>
            </details>

            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">Event timeline</div>
              <div className="mt-3 space-y-2">
                {events.length === 0 && <div className="text-xs text-black/50">No events recorded.</div>}
                {events.map((event, index) => {
                  const isError = String(event.event_type).includes("failed") || String(event.event_type).includes("error");
                  return (
                    <div
                      key={`${event.created_at}-${index}`}
                      className={`rounded-xl border px-3 py-2 ${
                        isError ? "border-rose-200 bg-rose-50" : "border-black/10 bg-white/80"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-black/50">
                        <span className="uppercase tracking-wide">{event.event_type}</span>
                        <span>{format(new Date(event.created_at), "HH:mm:ss")}</span>
                      </div>
                      {event.detail?.error_message && (
                        <div className="mt-1 text-xs text-rose-600">{event.detail.error_message}</div>
                      )}
                      {event.detail?.duration_ms && (
                        <div className="mt-1 text-xs text-black/60">{event.detail.duration_ms}ms</div>
                      )}
                      <details className="mt-2 text-xs text-black/50">
                        <summary className="cursor-pointer uppercase tracking-wide">Detail</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(event.detail ?? {}, null, 2)}</pre>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
