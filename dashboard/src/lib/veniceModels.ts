export type VeniceModel = {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  model_spec?: unknown;
  [key: string]: unknown;
};

type VeniceModelType = "image" | "text";

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
  const hints = [
    model.type,
    (model as any).model_type,
    (model as any).modality,
    (model as any).model_spec?.type,
    (model as any).model_spec?.modality,
    (model as any).model_spec?.modalities,
    (model as any).modalities,
    (model as any).capabilities,
    (model as any).model_spec?.capabilities
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
  const hasImage = hints.some(
    (hint) => hint.includes("image") || hint.includes("vision") || hint.includes("diffusion")
  );
  const hasText = hints.some(
    (hint) =>
      hint.includes("text") ||
      hint.includes("chat") ||
      hint.includes("llm") ||
      hint.includes("language") ||
      hint.includes("completion")
  );
  const isMultimodal = hints.some((hint) => hint.includes("multimodal"));

  if (type === "image") return hasImage || isMultimodal;
  return hasText || isMultimodal;
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
    return options?.type ? cachedModels.filter((model) => matchesType(model, options.type!)) : cachedModels;
  }

  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VENICE_API_KEY");
  }

  const response = await fetch("https://api.venice.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Venice models fetch failed: ${response.status} ${text}`);
  }

  const payload = await response.json().catch(() => ({}));
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

  return options?.type ? models.filter((model) => matchesType(model, options.type!)) : models;
}
