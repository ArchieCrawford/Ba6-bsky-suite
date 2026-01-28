export type VeniceModel = {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  model_spec?: unknown;
  [key: string]: unknown;
};

type VeniceModelType = "image" | "text" | "video";

const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedModels: VeniceModel[] | null = null;
let cachedAt = 0;

function normalizeTokens(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeTokens(item));
  }
  if (typeof value === "string") {
    return value
      .split(/[^a-z0-9]+/i)
      .map((token) => token.toLowerCase())
      .filter(Boolean);
  }
  if (typeof value === "object") {
    const tokens: string[] = [];
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (typeof entry === "boolean") {
        if (entry) tokens.push(...normalizeTokens(key));
        return;
      }
      tokens.push(...normalizeTokens(key));
      tokens.push(...normalizeTokens(entry));
    });
    return tokens;
  }
  return [];
}

function collectTypeHints(model: VeniceModel): string[] {
  const id = model.id ?? "";
  const name = typeof model.name === "string" ? model.name : "";
  const description = typeof model.description === "string" ? model.description : "";
  const hints = [
    id,
    name,
    description,
    model.type,
    (model as any).model_type,
    (model as any).modality,
    (model as any).model_spec?.type,
    (model as any).model_spec?.modality,
    (model as any).model_spec?.modalities,
    (model as any).modalities,
    (model as any).capabilities,
    (model as any).model_spec?.capabilities,
    (model as any).tags,
    (model as any).categories,
    (model as any).category,
    (model as any).use_case,
    (model as any).input_type,
    (model as any).output_type,
    (model as any).model_spec?.input,
    (model as any).model_spec?.output,
    (model as any).model_spec?.input_type,
    (model as any).model_spec?.output_type,
    (model as any).model_spec?.family,
    (model as any).model_spec?.name,
    (model as any).model_spec?.description
  ].flatMap((value) => normalizeTokens(value));

  if ((model as any).supportsVision || (model as any).model_spec?.supportsVision) {
    hints.push("vision", "image");
  }
  if ((model as any).supportsText || (model as any).model_spec?.supportsText) {
    hints.push("text");
  }

  return Array.from(new Set(hints));
}

function matchesType(model: VeniceModel, type: VeniceModelType): boolean {
  const hints = collectTypeHints(model);
  if (hints.length === 0) return false;
  const imageKeywords = [
    "image",
    "img",
    "vision",
    "diffusion",
    "sdxl",
    "stable",
    "flux",
    "schnell",
    "turbo",
    "photo",
    "photography",
    "photoreal",
    "illustration",
    "anime",
    "art",
    "render",
    "sketch",
    "visual",
    "portrait",
    "painting"
  ];
  const textKeywords = [
    "text",
    "chat",
    "llm",
    "language",
    "completion",
    "instruct",
    "assistant",
    "gpt",
    "llama",
    "mistral",
    "mixtral",
    "qwen",
    "gemma",
    "claude",
    "command",
    "cohere",
    "reason",
    "summarize",
    "summarization",
    "nlp",
    "dialog"
  ];
  const videoKeywords = [
    "video",
    "movie",
    "animation",
    "animate",
    "frame",
    "frames",
    "clip",
    "video-to-video",
    "image-to-video",
    "text-to-video"
  ];

  const hasImage = hints.some((hint) => imageKeywords.some((key) => hint.includes(key)));
  const hasText = hints.some((hint) => textKeywords.some((key) => hint.includes(key)));
  const hasVideo = hints.some((hint) => videoKeywords.some((key) => hint.includes(key)));
  const isMultimodal = hints.some((hint) => hint.includes("multimodal"));

  if (type === "image") return hasImage || isMultimodal;
  if (type === "video") return hasVideo || isMultimodal;
  return hasText || isMultimodal;
}

const IMAGE_MODELS: Array<{ id: string; name: string }> = [
  { id: "venice-sd35", name: "Venice SD35" },
  { id: "hidream", name: "HiDream" },
  { id: "flux-2-pro", name: "Flux 2 Pro" },
  { id: "flux-2-max", name: "Flux 2 Max" },
  { id: "gpt-image-1-5", name: "GPT Image 1.5" },
  { id: "imagineart-1.5-pro", name: "ImagineArt 1.5 Pro" },
  { id: "nano-banana-pro", name: "Nano Banana Pro" },
  { id: "seedream-v4", name: "Seedream V4.5" },
  { id: "lustify-sdxl", name: "Lustify SDXL" },
  { id: "lustify-v7", name: "Lustify v7" },
  { id: "qwen-image", name: "Qwen Image" },
  { id: "wai-illustrious", name: "Anime (WAI)" },
  { id: "z-image-turbo", name: "Z-Image Turbo" },
  { id: "bg-remover", name: "Background Remover" },
  { id: "upscaler", name: "Upscaler" },
  { id: "qwen-edit", name: "Qwen Edit 2511" }
];

const TEXT_MODELS: Array<{ id: string; name: string }> = [
  { id: "venice-uncensored", name: "Venice Uncensored 1.1" },
  { id: "zai-org-glm-4.7", name: "GLM 4.7" },
  { id: "qwen3-4b", name: "Venice Small" },
  { id: "mistral-31-24b", name: "Venice Medium" },
  { id: "qwen3-235b-a22b-thinking-2507", name: "Qwen 3 235B A22B Thinking 2507" },
  { id: "qwen3-235b-a22b-instruct-2507", name: "Qwen 3 235B A22B Instruct 2507" },
  { id: "qwen3-next-80b", name: "Qwen 3 Next 80B" },
  { id: "qwen3-coder-480b-a35b-instruct", name: "Qwen 3 Coder 480B" },
  { id: "hermes-3-llama-3.1-405b", name: "Hermes 3 Llama 3.1 405B" },
  { id: "google-gemma-3-27b-it", name: "Google Gemma 3 27B Instruct" },
  { id: "grok-41-fast", name: "Grok 4.1 Fast" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro Preview" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
  { id: "claude-opus-45", name: "Claude Opus 4.5" },
  { id: "claude-sonnet-45", name: "Claude Sonnet 4.5" },
  { id: "openai-gpt-oss-120b", name: "OpenAI GPT OSS 120B" },
  { id: "kimi-k2-thinking", name: "Kimi K2 Thinking" },
  { id: "deepseek-v3.2", name: "DeepSeek V3.2" },
  { id: "llama-3.2-3b", name: "Llama 3.2 3B" },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
  { id: "openai-gpt-52", name: "GPT-5.2" },
  { id: "openai-gpt-52-codex", name: "GPT-5.2 Codex" },
  { id: "minimax-m21", name: "MiniMax M2.1" },
  { id: "grok-code-fast-1", name: "Grok Code Fast 1" },
  { id: "kimi-k2-5", name: "Kimi K2.5" },
  { id: "qwen3-vl-235b-a22b", name: "Qwen3 VL 235B" }
];

const VIDEO_MODELS: Array<{ id: string; name: string }> = [
  { id: "wan-2.6-image-to-video", name: "Wan 2.6 Image to Video" },
  { id: "wan-2.6-flash-image-to-video", name: "Wan 2.6 Flash Image to Video" },
  { id: "wan-2.6-text-to-video", name: "Wan 2.6 Text to Video" },
  { id: "wan-2.5-preview-image-to-video", name: "Wan 2.5 Preview Image to Video" },
  { id: "wan-2.5-preview-text-to-video", name: "Wan 2.5 Preview Text to Video" },
  { id: "wan-2.2-a14b-text-to-video", name: "Wan 2.2 A14B Text to Video" },
  { id: "wan-2.1-pro-image-to-video", name: "Wan 2.1 Pro Image to Video" },
  { id: "ltx-2-fast-image-to-video", name: "LTX Video 2.0 Fast Image to Video" },
  { id: "ltx-2-fast-text-to-video", name: "LTX Video 2.0 Fast Text to Video" },
  { id: "ltx-2-full-image-to-video", name: "LTX Video 2.0 Full Image to Video" },
  { id: "ltx-2-full-text-to-video", name: "LTX Video 2.0 Full Text to Video" },
  { id: "ltx-2-19b-full-text-to-video", name: "LTX Video 2.0 19B Text to Video" },
  { id: "ltx-2-19b-full-image-to-video", name: "LTX Video 2.0 19B Image to Video" },
  { id: "ltx-2-19b-distilled-text-to-video", name: "LTX Video 2.0 19B Distilled Text to Video" },
  { id: "ltx-2-19b-distilled-image-to-video", name: "LTX Video 2.0 19B Distilled Image to Video" },
  { id: "ovi-image-to-video", name: "Ovi Image to Video" },
  { id: "kling-2.6-pro-text-to-video", name: "Kling 2.6 Pro Text to Video" },
  { id: "kling-2.6-pro-image-to-video", name: "Kling 2.6 Pro Image to Video" },
  { id: "kling-2.5-turbo-pro-text-to-video", name: "Kling 2.5 Turbo Pro Text to Video" },
  { id: "kling-2.5-turbo-pro-image-to-video", name: "Kling 2.5 Turbo Pro Image to Video" },
  { id: "longcat-distilled-image-to-video", name: "Longcat Distilled Image to Video" },
  { id: "longcat-distilled-text-to-video", name: "Longcat Distilled Text to Video" },
  { id: "longcat-image-to-video", name: "Longcat Full Quality Image to Video" },
  { id: "longcat-text-to-video", name: "Longcat Full Quality Text to Video" },
  { id: "veo3-fast-text-to-video", name: "Veo 3 Fast Text to Video" },
  { id: "veo3-fast-image-to-video", name: "Veo 3 Fast Image to Video" },
  { id: "veo3-full-text-to-video", name: "Veo 3 Full Quality Text to Video" },
  { id: "veo3-full-image-to-video", name: "Veo 3 Full Quality Image to Video" },
  { id: "veo3.1-fast-text-to-video", name: "Veo 3.1 Fast Text to Video" },
  { id: "veo3.1-fast-image-to-video", name: "Veo 3.1 Fast Image to Video" },
  { id: "veo3.1-full-text-to-video", name: "Veo 3.1 Full Quality Text to Video" },
  { id: "veo3.1-full-image-to-video", name: "Veo 3.1 Full Quality Image to Video" },
  { id: "sora-2-image-to-video", name: "Sora 2 Image to Video" },
  { id: "sora-2-pro-image-to-video", name: "Sora 2 Pro Image to Video" },
  { id: "sora-2-text-to-video", name: "Sora 2 Text to Video" },
  { id: "sora-2-pro-text-to-video", name: "Sora 2 Pro Text to Video" }
];

const TYPE_ALLOWLIST: Record<VeniceModelType, Array<{ id: string; name: string }>> = {
  image: IMAGE_MODELS,
  text: TEXT_MODELS,
  video: VIDEO_MODELS
};

function applyAllowlist(models: VeniceModel[], type: VeniceModelType): VeniceModel[] | null {
  const allowlist = TYPE_ALLOWLIST[type];
  if (!allowlist || allowlist.length === 0) return null;
  const byId = new Map(models.map((model) => [model.id.toLowerCase(), model]));
  return allowlist.map((entry) => {
    const existing = byId.get(entry.id.toLowerCase());
    return (
      existing ?? {
        id: entry.id,
        name: entry.name
      }
    );
  });
}

function allowlistFallback(type?: VeniceModelType): VeniceModel[] | null {
  if (!type) return null;
  const allowlist = TYPE_ALLOWLIST[type];
  if (!allowlist || allowlist.length === 0) return null;
  return allowlist.map((entry) => ({ id: entry.id, name: entry.name }));
}

function toModel(value: any): VeniceModel | null {
  const id = value?.id ?? value?.model_id ?? value?.slug;
  if (!id) return null;
  return {
    ...(typeof value === "object" && value ? value : {}),
    id: String(id),
    name:
      typeof value?.name === "string"
        ? value.name
        : typeof value?.model_spec?.name === "string"
          ? value.model_spec.name
          : undefined,
    description:
      typeof value?.description === "string"
        ? value.description
        : typeof value?.model_spec?.description === "string"
        ? value.model_spec.description
        : undefined,
    type:
      typeof value?.type === "string"
        ? value.type
        : typeof value?.model_type === "string"
          ? value.model_type
          : undefined,
    model_spec: value?.model_spec ?? value?.spec ?? undefined
  };
}

export async function getVeniceModels(options?: { type?: VeniceModelType }): Promise<VeniceModel[]> {
  if (cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
    if (options?.type) {
      const allowlisted = applyAllowlist(cachedModels, options.type);
      if (allowlisted) return allowlisted;
      const filtered = cachedModels.filter((model) => matchesType(model, options.type!));
      return filtered.length > 0 ? filtered : cachedModels;
    }
    return cachedModels;
  }

  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    const fallback = allowlistFallback(options?.type);
    if (fallback) return fallback;
    throw new Error("Missing VENICE_API_KEY");
  }

  let payload: any;
  try {
    const response = await fetch("https://api.venice.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Venice models fetch failed: ${response.status} ${text}`);
    }

    payload = await response.json().catch(() => ({}));
  } catch (err) {
    const fallback = allowlistFallback(options?.type);
    if (fallback) return fallback;
    throw err;
  }
  const raw =
    payload?.data ??
    payload?.models ??
    payload?.items ??
    payload?.results ??
    (Array.isArray(payload) ? payload : []);

  if (!Array.isArray(raw)) {
    throw new Error("Unexpected Venice models response");
  }

  const models = raw
    .map((item) => toModel(item))
    .filter((item): item is VeniceModel => !!item);

  cachedModels = models;
  cachedAt = Date.now();

  if (options?.type) {
    const allowlisted = applyAllowlist(models, options.type);
    if (allowlisted) return allowlisted;
    const filtered = models.filter((model) => matchesType(model, options.type!));
    return filtered.length > 0 ? filtered : models;
  }
  return models;
}
