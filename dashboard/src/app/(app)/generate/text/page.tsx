"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const MODEL_STORAGE_KEY = "ba6_ai_text_model";
const DRAFT_PREFILL_KEY = "ba6_draft_prefill";

const PRESETS = [
  "10 Bluesky posts",
  "Rewrite shorter + punchier",
  "Turn into a thread (5 parts)",
  "Add CTA + hashtags"
];

async function getAuthHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Missing session");
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export default function GenerateTextPage() {
  const router = useRouter();
  const [models, setModels] = useState<VeniceModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const res = await fetch("/api/ai/venice/models?type=text");
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

  const canGenerate = useMemo(() => {
    return !!modelId && !!prompt.trim() && !generating;
  }, [modelId, prompt, generating]);

  const generateText = async () => {
    if (!modelId) {
      toast.error("Select a Venice model");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Prompt is required");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/ai/text/generate", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          label: label.trim() || undefined,
          prompt: prompt.trim(),
          model: modelId
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to generate text");
      }
      setOutput(payload?.text ?? "");
      toast.success("Text generated");
    } catch (err: any) {
      const message = err?.message ?? "Failed to generate text";
      setGenerateError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const copyOutput = async () => {
    if (!output.trim()) return;
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Unable to copy");
    }
  };

  const sendToScheduler = () => {
    if (!output.trim()) {
      toast.error("Generate text first");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DRAFT_PREFILL_KEY, output);
    }
    router.push("/drafts");
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/40">Generate</div>
            <div className="text-sm text-black/60">Single-shot text generation.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setPrompt("")} className="w-full sm:w-auto">
            Clear
          </Button>
        </div>
      </div>

      <Card>
        <div className="text-sm font-semibold uppercase tracking-wide text-black/50">New text</div>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Title / Label (optional)</label>
            <Input
              placeholder="BA6 copy ideas"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">Prompt</label>
            <Textarea
              rows={6}
              placeholder="What should the model write?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="min-h-[44px] rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black/70 hover:bg-black/5"
                onClick={() => setPrompt(preset)}
              >
                {preset}
              </button>
            ))}
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
              <div className="mt-2 text-xs text-rose-600">No text models available.</div>
            )}
          </div>
          <Button onClick={generateText} disabled={!canGenerate || models.length === 0} className="w-full sm:w-auto">
            {generating ? "Generating..." : "Generate text"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-black/50">Output</div>
            <div className="text-xs text-black/50">Ready to copy or schedule.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={copyOutput} disabled={!output.trim()}>
              Copy
            </Button>
            <Button size="sm" onClick={sendToScheduler} disabled={!output.trim()}>
              Send to Scheduler
            </Button>
          </div>
        </div>
        {generateError && <div className="mt-3 text-xs text-rose-600">{generateError}</div>}
        <div className="mt-4">
          <Textarea
            rows={8}
            value={output}
            placeholder="Generated text will appear here..."
            readOnly
          />
        </div>
      </Card>
    </div>
  );
}
