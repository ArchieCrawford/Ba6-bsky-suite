import Stripe from "stripe";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

type PayGateConfig = {
  provider?: string;
  gate_actions?: string[] | string;
  price_id?: string;
  lookup_key?: string;
  billing_mode?: string;
  amount_display?: string;
  currency?: string;
};

let stripeClient: Stripe | null = null;

function requireStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing env: STRIPE_SECRET_KEY");
  }
  return key;
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requireStripeKey(), { apiVersion: "2024-06-20" });
  }
  return stripeClient;
}

const normalizeGateActions = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
};

export async function getPayGateForAction(feedId: string, gateAction: string) {
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("feed_gates")
    .select("id,config,is_enabled")
    .eq("feed_id", feedId)
    .eq("gate_type", "pay_gate")
    .eq("is_enabled", true);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ id: string; config: PayGateConfig | null; is_enabled: boolean }>;
  for (const row of rows) {
    const config = (row.config ?? {}) as PayGateConfig;
    if (config.provider && config.provider !== "stripe") continue;
    const actions = normalizeGateActions(config.gate_actions);
    if (actions.includes(gateAction)) {
      return { id: row.id, config };
    }
  }
  return null;
}

export async function findStripeCustomerIdForUser(userId: string) {
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .schema("stripe")
    .from("customers")
    .select("id,metadata,deleted")
    .eq("metadata->>supabase_user_id", userId);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ id: string; deleted?: boolean | null }>;
  const active = rows.find((row) => !row.deleted) ?? rows[0];
  return active?.id ?? null;
}

export async function ensureStripeCustomerId(userId: string, email?: string | null) {
  const existing = await findStripeCustomerIdForUser(userId);
  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId }
  });
  return customer.id;
}

export async function hasEntitlement(userId: string, lookupKey: string) {
  if (!lookupKey) return false;
  const customerId = await findStripeCustomerIdForUser(userId);
  if (!customerId) return false;

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .schema("stripe")
    .from("active_entitlements")
    .select("id")
    .eq("customer", customerId)
    .eq("lookup_key", lookupKey)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export type { PayGateConfig };
