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

type VeniceModel = {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  model_spec?: unknown;
};

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

const MODEL_STORAGE_KEY = "ba6_ai_image_model";

export default function GenerateImagePage() {
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [assets, setAssets] = useState<AiAsset[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<VeniceModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [label, setLabel] = useState("");
  const [modelId, setModelId] = useState("");
  const [size, setSize] = useState(SIZE_OPTIONS[0].value);
  const [steps, setSteps] = useState("");
  const [cfgScale, setCfgScale] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AiAsset | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);

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

  useEffect(() => {
    let active = true;
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const res = await fetch("/api/ai/venice/models?type=image");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load models");
        }
        if (!active) return;
        const list = (payload.models ?? []) as VeniceModel[];
        setModels(list);
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(MODEL_STORAGE_KEY) : null;
        const defaultModel = list.find((item) => item.id === stored) ?? list[0];
        if (defaultModel) {
          setModelId(defaultModel.id);
        }
      } catch (err: any) {
        if (!active) return;
        setModelsError(err?.message ?? "Unable to fetch Venice models");
      } finally {
        if (active) {
          setModelsLoading(false);
        }
      }
    };
    fetchModels();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (modelId && typeof window !== "undefined") {
      window.localStorage.setItem(MODEL_STORAGE_KEY, modelId);
    }
  }, [modelId]);

  const activeJob = useMemo(() => jobs.find((job) => ["queued", "running"].includes(job.status)), [jobs]);
  const limitReached = usage ? usage.used_today >= usage.daily_limit : false;

  const jobLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((job) => {
      const labelValue = (job.params as any)?.label;
      if (typeof labelValue === "string" && labelValue.trim()) {
        map.set(job.id, labelValue.trim());
      }
    });
    return map;
  }, [jobs]);

  useEffect(() => {
    if (!activeJob) return;
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeJob, loadData]);

  useEffect(() => {
    if (!selectedAsset) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedAsset(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedAsset]);

  useEffect(() => {
    if (!selectedAsset) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedAsset]);

  useEffect(() => {
    if (!selectedAsset) {
      setLightboxLoading(false);
    }
  }, [selectedAsset]);

  const downloadFromUrl = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const submitJob = async () => {
    if (!modelId) {
      toast.error("Select a Venice model");
      return;
    }
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

    const parsedSteps = steps.trim() ? Number(steps) : undefined;
    if (parsedSteps !== undefined) {
      if (!Number.isFinite(parsedSteps) || parsedSteps < 1 || parsedSteps > 60) {
        toast.error("Steps must be a number between 1 and 60.");
        return;
      }
    }
    const parsedCfg = cfgScale.trim() ? Number(cfgScale) : undefined;
    if (parsedCfg !== undefined) {
      if (!Number.isFinite(parsedCfg) || parsedCfg <= 0 || parsedCfg > 20) {
        toast.error("Quality (CFG scale) must be between 0.1 and 20.");
        return;
      }
    }

    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const params: Record<string, unknown> = {
        ...(parsedSteps !== undefined ? { steps: Math.round(parsedSteps) } : {}),
        ...(parsedCfg !== undefined ? { cfg_scale: parsedCfg } : {})
      };
      const res = await fetch("/api/ai/image/jobs", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          label: label.trim() || undefined,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          model: modelId,
          size,
          params: Object.keys(params).length ? params : undefined
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to create job");
      }
      toast.success("Image job queued");
      setPrompt("");
      setNegativePrompt("");
      setLabel("");
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Title / Label (optional)</label>
            <Input
              placeholder="BA6 visual concept"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Prompt</label>
          <Textarea
            rows={4}
            placeholder="Describe the image you want to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Negative prompt (optional)</label>
            <Textarea
              rows={2}
              placeholder="What should the model avoid?"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Model</label>
              <Select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={modelsLoading || models.length === 0}
                required
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name ? `${model.name} — ${model.id}` : model.id}
                  </option>
                ))}
              </Select>
              {modelsError && <div className="mt-2 text-xs text-rose-600">{modelsError}</div>}
              {!modelsError && models.length === 0 && !modelsLoading && (
                <div className="mt-2 text-xs text-rose-600">No image models available.</div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Size</label>
              <Select value={size} onChange={(e) => setSize(e.target.value)}>
              {SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Steps (optional)</label>
              <Input
                type="number"
                min={1}
                max={60}
                step={1}
                placeholder="e.g. 30 (leave blank for default)"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
              <div className="mt-1 text-[11px] text-black/40">Leave blank for defaults. Higher steps can improve detail but take longer.</div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Quality (CFG scale)</label>
              <Input
                type="number"
                min={0.1}
                max={20}
                step={0.1}
                placeholder="e.g. 7.5"
                value={cfgScale}
                onChange={(e) => setCfgScale(e.target.value)}
              />
              <div className="mt-1 text-[11px] text-black/40">Higher values follow the prompt more closely.</div>
            </div>
          </div>
          <Button
            onClick={submitJob}
            disabled={creating || !!activeJob || limitReached || models.length === 0}
            className="w-full sm:w-auto"
          >
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
                  title={(jobLabelMap.get(job.id) ?? job.prompt).slice(0, 70)}
                  subtitle={formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  status={<StatusPill status={job.status} />}
                  details={
                    <div className="space-y-2">
                      {jobLabelMap.get(job.id) && (
                        <div>
                          <div className="text-[11px] uppercase text-black/40">Label</div>
                          <div>{jobLabelMap.get(job.id)}</div>
                        </div>
                      )}
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
                    <div className="text-sm font-semibold text-ink">{jobLabelMap.get(job.id) ?? job.prompt}</div>
                    <div className="text-xs text-black/50">
                      {job.provider} · {job.model} ·{" "}
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </div>
                    {jobLabelMap.get(job.id) && (
                      <div className="text-xs text-black/50">Label: {jobLabelMap.get(job.id)}</div>
                    )}
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
                    alt={jobLabelMap.get(asset.job_id) ?? "Generated asset"}
                    className="h-48 w-full cursor-pointer object-cover"
                    onClick={() => {
                      setSelectedAsset(asset);
                      setLightboxLoading(true);
                    }}
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-black/5 text-xs text-black/40">
                    Signed URL unavailable
                  </div>
                )}
                <div className="space-y-1 px-3 py-2 text-xs text-black/60">
                  <div className="text-[11px] uppercase text-black/40">
                    {jobLabelMap.get(asset.job_id) ?? "Generated asset"}
                  </div>
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

      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSelectedAsset(null)}
          />
          <div
            className="relative mx-4 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-black/40">Gallery</div>
                <div className="text-lg font-semibold text-ink">
                  {jobLabelMap.get(selectedAsset.job_id) ?? "Generated asset"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!selectedAsset.signed_url) return;
                    const filename = `ba6_ai_${selectedAsset.job_id}_${selectedAsset.id}.webp`;
                    downloadFromUrl(selectedAsset.signed_url, filename);
                  }}
                  aria-label="Download image"
                >
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAsset(null)}
                  aria-label="Close preview"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center">
              {selectedAsset.signed_url ? (
                <>
                  {lightboxLoading && (
                    <div className="absolute text-xs text-black/50">Loading image…</div>
                  )}
                  <img
                    src={selectedAsset.signed_url}
                    alt={jobLabelMap.get(selectedAsset.job_id) ?? "Generated asset"}
                    className="max-h-[70vh] w-auto max-w-full object-contain"
                    loading="eager"
                    onLoad={() => setLightboxLoading(false)}
                    onError={() => setLightboxLoading(false)}
                  />
                </>
              ) : (
                <div className="text-sm text-black/50">Signed URL unavailable</div>
              )}
            </div>

            <div className="mt-4 grid gap-2 text-xs text-black/60 sm:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase text-black/40">Created</div>
                <div>{formatDistanceToNow(new Date(selectedAsset.created_at), { addSuffix: true })}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-black/40">Dimensions</div>
                <div>
                  {selectedAsset.width && selectedAsset.height
                    ? `${selectedAsset.width} × ${selectedAsset.height}`
                    : "Unknown"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-black/40">Asset</div>
                <div>{selectedAsset.id}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
