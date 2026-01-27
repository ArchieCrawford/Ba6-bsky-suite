"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { MobileCard } from "@/components/ui/MobileCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { toast } from "sonner";

type AiJob = {
  id: string;
  status: string;
  model: string;
  prompt: string;
  negative_prompt: string | null;
  params: Record<string, unknown> | null;
  provider: string;
  created_at: string;
  updated_at: string;
  error: string | null;
};

type AiAsset = {
  id: string;
  job_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  created_at: string;
  signed_url: string | null;
};

type UsageInfo = {
  daily_limit: number;
  used_today: number;
  active_count: number;
};

const SIZE_OPTIONS = [
  { label: "1024 × 1024", value: "1024x1024" },
  { label: "1152 × 896", value: "1152x896" },
  { label: "896 × 1152", value: "896x1152" },
  { label: "1280 × 720", value: "1280x720" },
  { label: "720 × 1280", value: "720x1280" }
];

const STATUS_STYLES: Record<string, string> = {
  queued: "border-amber-200 bg-amber-100 text-amber-700",
  running: "border-sky-200 bg-sky-100 text-sky-700",
  succeeded: "border-emerald-200 bg-emerald-100 text-emerald-700",
  failed: "border-rose-200 bg-rose-100 text-rose-700",
  canceled: "border-slate-200 bg-slate-100 text-slate-700"
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        STATUS_STYLES[status] ?? "border-slate-200 bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

async function getAuthHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Missing session");
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export default function GenerateImagePage() {
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [assets, setAssets] = useState<AiAsset[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState("venice");
  const [size, setSize] = useState(SIZE_OPTIONS[0].value);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/ai/image/jobs/list", { headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load jobs");
      }
      setJobs((payload.jobs ?? []) as AiJob[]);
      setAssets((payload.assets ?? []) as AiAsset[]);
      setUsage(payload.usage ?? null);
    } catch (err: any) {
      const message = err?.message ?? "Failed to load jobs";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeJob = useMemo(() => jobs.find((job) => ["queued", "running"].includes(job.status)), [jobs]);
  const limitReached = usage ? usage.used_today >= usage.daily_limit : false;

  useEffect(() => {
    if (!activeJob) return;
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeJob, loadData]);

  const submitJob = async () => {
    if (!prompt.trim()) {
      toast.error("Prompt is required");
      return;
    }
    if (limitReached) {
      toast.error("Daily image limit reached");
      return;
    }
    if (activeJob) {
      toast.error("Wait for the current job to finish");
      return;
    }

    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/ai/image/jobs", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          model: model.trim() || "venice",
          size
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to create job");
      }
      toast.success("Image job queued");
      setPrompt("");
      setNegativePrompt("");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingState label="Loading image jobs" />;
  if (error) return <ErrorState title="Image jobs unavailable" subtitle={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Generate</div>
            <div className="text-sm text-black/60">Venice image jobs for your account.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={loadData} className="w-full sm:w-auto">
            Refresh
          </Button>
        </div>
      </div>

      {limitReached && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Daily limit reached ({usage?.used_today ?? 0}/{usage?.daily_limit ?? 0}). Try again tomorrow.
        </div>
      )}

      {activeJob && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          Job in progress: {activeJob.prompt.slice(0, 80)}
        </div>
      )}

      <Card>
        <div className="text-sm font-semibold uppercase tracking-wide text-black/50">New image</div>
        <div className="mt-4 grid gap-4">
          <Textarea
            rows={4}
            placeholder="Describe the image you want to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Input
            placeholder="Negative prompt (optional)"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Model (per Venice docs)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <Select value={size} onChange={(e) => setSize(e.target.value)}>
              {SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={submitJob} disabled={creating || !!activeJob || limitReached} className="w-full sm:w-auto">
            {creating ? "Queueing..." : "Generate image"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Recent jobs</div>
            <div className="text-xs text-black/50">Track job status and errors.</div>
          </div>
          {usage && (
            <div className="text-xs text-black/50">
              {usage.used_today}/{usage.daily_limit} jobs today
            </div>
          )}
        </div>

        {jobs.length === 0 ? (
          <EmptyState title="No jobs yet" subtitle="Queue an image job to see status updates." />
        ) : (
          <>
            <div className="mt-4 space-y-3 sm:hidden">
              {jobs.map((job) => (
                <MobileCard
                  key={job.id}
                  title={job.prompt.slice(0, 70)}
                  subtitle={formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  status={<StatusPill status={job.status} />}
                  details={
                    <div className="space-y-2">
                      <div>
                        <div className="text-[11px] uppercase text-black/40">Model</div>
                        <div>{job.model}</div>
                      </div>
                      {job.negative_prompt && (
                        <div>
                          <div className="text-[11px] uppercase text-black/40">Negative prompt</div>
                          <div>{job.negative_prompt}</div>
                        </div>
                      )}
                      {job.error && (
                        <div className="text-rose-600">
                          <div className="text-[11px] uppercase">Error</div>
                          <div>{job.error}</div>
                        </div>
                      )}
                    </div>
                  }
                >
                  <div className="text-xs text-black/50">
                    {job.provider} · {job.model}
                  </div>
                </MobileCard>
              ))}
            </div>
            <div className="mt-4 hidden divide-y divide-black/5 sm:block">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-start justify-between gap-4 py-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-ink">{job.prompt}</div>
                    <div className="text-xs text-black/50">
                      {job.provider} · {job.model} ·{" "}
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </div>
                    {job.negative_prompt && (
                      <div className="text-xs text-black/50">Negative: {job.negative_prompt}</div>
                    )}
                    {job.error && <div className="text-xs text-rose-600">Error: {job.error}</div>}
                  </div>
                  <StatusPill status={job.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Gallery</div>
        {assets.length === 0 ? (
          <div className="mt-3 text-sm text-black/50">No images yet.</div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <div key={asset.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white/80">
                {asset.signed_url ? (
                  <img
                    src={asset.signed_url}
                    alt="Generated asset"
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-black/5 text-xs text-black/40">
                    Signed URL unavailable
                  </div>
                )}
                <div className="space-y-1 px-3 py-2 text-xs text-black/60">
                  <div>{formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}</div>
                  {asset.width && asset.height && (
                    <div>
                      {asset.width} × {asset.height}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
