"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";

type AssetRow = {
  id: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  created_at: string;
};

type JobRow = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  model: string;
  prompt: string;
  params: any;
  error: string | null;
  created_at: string;
  ai_assets: AssetRow[];
};

type RenderItem = {
  job: JobRow;
  urls: Record<string, string>;
};

const MODEL_OPTIONS = [
  { value: "z-image-turbo", label: "Turbo" },
  { value: "z-image", label: "Standard" }
];

const SIZE_OPTIONS = [
  { value: 768, label: "768 × 768" },
  { value: 1024, label: "1024 × 1024" },
  { value: 1536, label: "1536 × 1536" }
];

export default function GenerateImagePage() {
  const [items, setItems] = useState<RenderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [size, setSize] = useState<number>(SIZE_OPTIONS[1].value);
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef<number | null>(null);

  const hasInFlight = useMemo(() => {
    return items.some((i) => i.job.status === "queued" || i.job.status === "running");
  }, [items]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionRes.session?.access_token) throw new Error("Missing session");

      const res = await fetch(`/api/ai/image/jobs/list?limit=50`, {
        headers: { Authorization: `Bearer ${sessionRes.session.access_token}` }
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to load jobs");

      const jobs: JobRow[] = Array.isArray(payload?.jobs) ? payload.jobs : [];

      const next: RenderItem[] = [];
      for (const job of jobs) {
        const urls: Record<string, string> = {};
        for (const asset of job.ai_assets ?? []) {
          const { data, error: signErr } = await supabase.storage
            .from("ai")
            .createSignedUrl(asset.storage_path, 60 * 30);
          if (!signErr && data?.signedUrl) {
            urls[asset.id] = data.signedUrl;
          }
        }
        next.push({ job, urls });
      }

      setItems(next);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();

    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      load();
    }, 2500);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [load]);

  const createJob = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Add a prompt");
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionRes.session?.access_token) throw new Error("Missing session");

      const res = await fetch("/api/ai/image/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionRes.session.access_token}`
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: negative.trim() ? negative.trim() : undefined,
          model,
          size
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to create job");

      toast.success("Queued");
      setPrompt("");
      setNegative("");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to queue image");
    } finally {
      setSubmitting(false);
    }
  }, [prompt, negative, model, size, load]);

  if (loading) {
    return <LoadingState label="Loading" />;
  }

  if (error) {
    return <ErrorState title="Unable to load" subtitle={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Generate Image</h1>
        <p className="text-sm text-black/60">Venice-powered image generation inside BA6.</p>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-4">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe what you want..." />
          </div>
          <div className="md:col-span-4">
            <Input
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
              placeholder="Negative prompt (optional)"
            />
          </div>
          <div>
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select value={String(size)} onChange={(e) => setSize(Number(e.target.value))}>
              {SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Button onClick={createJob} disabled={submitting || hasInFlight}>
              {hasInFlight ? "Job in progress" : submitting ? "Queuing..." : "Generate"}
            </Button>
            <Button variant="secondary" onClick={load} disabled={submitting}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="No images yet" subtitle="Generate your first image to see it here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map(({ job, urls }) => {
            const assets = job.ai_assets ?? [];
            return (
              <Card key={job.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={job.status} />
                      <span className="text-xs text-black/50">{format(new Date(job.created_at), "PPpp")}</span>
                    </div>
                    <div className="mt-1 text-sm font-medium">{job.model}</div>
                    <div className="mt-1 line-clamp-3 text-sm text-black/70">{job.prompt}</div>
                    {job.error ? <div className="mt-2 text-sm text-red-600">{job.error}</div> : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {assets.map((a) => {
                    const url = urls[a.id];
                    return url ? (
                      <a key={a.id} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt="Generated"
                          className="h-40 w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                      </a>
                    ) : (
                      <div key={a.id} className="h-40 w-full rounded-xl bg-black/5" />
                    );
                  })}
                  {job.status !== "succeeded" && assets.length === 0 ? (
                    <div className="col-span-2 h-40 w-full rounded-xl bg-black/5" />
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
