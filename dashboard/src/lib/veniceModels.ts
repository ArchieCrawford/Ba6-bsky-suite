export type VeniceModel = {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  model_spec?: unknown;
  [key: string]: unknown;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedModels: VeniceModel[] | null = null;
let cachedAt = 0;

function normalizeType(value?: unknown) {
  if (!value) return null;
  const type = String(value).toLowerCase();
  return type;
}

function inferModelType(model: VeniceModel): string | null {
  const direct =
    normalizeType(model.type) ||
    normalizeType((model as any).model_type) ||
    normalizeType((model as any).modality) ||
    normalizeType((model as any).model_spec?.type) ||
    normalizeType((model as any).model_spec?.modality);

  if (direct) return direct;

  const capabilities = (model as any).capabilities;
  if (Array.isArray(capabilities)) {
    const imageCap = capabilities.find((cap) => normalizeType(cap)?.includes("image"));
    if (imageCap) return "image";
  }

  const modalities = (model as any).modalities;
  if (Array.isArray(modalities)) {
    const imageModality = modalities.find((cap) => normalizeType(cap)?.includes("image"));
    if (imageModality) return "image";
  }

  return null;
}

function toModel(value: any): VeniceModel | null {
  const id = value?.id ?? value?.model_id ?? value?.slug;
  if (!id) return null;
  return {
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
    type: typeof value?.type === "string" ? value.type : undefined,
    model_spec: value?.model_spec ?? value?.spec ?? undefined
  };
}

export async function getVeniceModels(): Promise<VeniceModel[]> {
  if (cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VENICE_API_KEY");
  }

  const response = await fetch("https://api.venice.ai/api/v1/models?type=image", {
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
    .filter((item): item is VeniceModel => !!item)
    .filter((item) => {
      const type = inferModelType(item);
      return type ? type.includes("image") : false;
    });

  cachedModels = models;
  cachedAt = Date.now();

  return models;
}
