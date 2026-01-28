"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { toast } from "sonner";

type VeniceModel = {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  model_spec?: unknown;
};

const MODEL_STORAGE_KEY = "ba6_ai_video_model";

async function getAuthHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Missing session");
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export default function GenerateVideoPage() {
  const [models, setModels] = useState<VeniceModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    let active = true;
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const res = await fetch("/api/ai/venice/models?type=video");
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
        if (active) setModelsLoading(false);
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

  const handleGenerate = async () => {
    try {
      await getAuthHeaders();
      toast.message("Video generation is coming soon. Models are ready for selection.");
    } catch (err: any) {
      toast.error(err?.message ?? "Missing session");
    }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Generate</div>
            <div className="text-sm text-black/60">Video generation (Venice models).</div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleGenerate} className="w-full sm:w-auto">
            Coming soon
          </Button>
        </div>
      </div>

      <Card>
        <div className="text-sm font-semibold uppercase tracking-wide text-black/50">New video</div>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Title / Label (optional)</label>
            <Input
              placeholder="BA6 cinematic concept"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Prompt</label>
            <Textarea
              rows={4}
              placeholder="Describe the video you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Model</label>
            <Select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={modelsLoading || models.length === 0}
              required
            >
              {modelsLoading && <option value="">Loading models...</option>}
              {!modelsLoading && models.length === 0 && <option value="">No models</option>}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name ? `${model.name} — ${model.id}` : model.id}
                </option>
              ))}
            </Select>
            {modelsError && <div className="mt-2 text-xs text-rose-600">{modelsError}</div>}
            {!modelsError && models.length === 0 && !modelsLoading && (
              <div className="mt-2 text-xs text-rose-600">No video models available.</div>
            )}
          </div>
          <Button onClick={handleGenerate} className="w-full sm:w-auto">
            Generate video (soon)
          </Button>
        </div>
      </Card>
    </div>
  );
}
