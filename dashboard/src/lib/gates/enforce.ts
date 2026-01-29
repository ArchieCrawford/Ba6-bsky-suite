import type { SupabaseClient } from "@supabase/supabase-js";
import { hasEntitlement } from "@/lib/billing";

type GateRow = {
  id: string;
  gate_type: string;
  config: Record<string, unknown> | null;
  is_enabled: boolean;
};

const normalizeLegacyAction = (value: string) => (value === "premium_features" ? "premium_rules" : value);

export const normalizeGateActions = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => normalizeLegacyAction(item.trim()));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [normalizeLegacyAction(value.trim())];
  }
  return [];
};

export async function getPayGateForAction(supa: SupabaseClient, feedId: string, action: string) {
  const { data, error } = await supa
    .from("feed_gates")
    .select("id,gate_type,config,is_enabled")
    .eq("feed_id", feedId)
    .eq("gate_type", "pay_gate")
    .eq("is_enabled", true);
  if (error) throw error;

  const rows = (data ?? []) as GateRow[];
  for (const row of rows) {
    const config = (row.config ?? {}) as Record<string, unknown>;
    const actions = normalizeGateActions(config.gate_actions);
    if (actions.includes(action)) {
      return { gate: row, config };
    }
  }
  return null;
}

export async function getTokenGateForAction(supa: SupabaseClient, feedId: string, action: string) {
  const { data, error } = await supa
    .from("feed_gates")
    .select("id,gate_type,config,is_enabled")
    .eq("feed_id", feedId)
    .eq("gate_type", "token_gate")
    .eq("is_enabled", true);
  if (error) throw error;

  const rows = (data ?? []) as GateRow[];
  for (const row of rows) {
    const config = (row.config ?? {}) as Record<string, unknown>;
    let actions = normalizeGateActions(config.gate_actions);
    if (actions.length === 0 && typeof config.action === "string") {
      actions = [normalizeLegacyAction(config.action.trim())];
    }
    if (actions.includes(action)) {
      return { gate: row, config };
    }
  }
  return null;
}

export class GateAccessError extends Error {
  status: number;
  reason: string;
  constructor(status: number, reason: string, message?: string) {
    super(message ?? reason);
    this.status = status;
    this.reason = reason;
  }
}

export const isGateAccessError = (err: unknown): err is GateAccessError => {
  return err instanceof GateAccessError;
};

export async function requireGateAccess(params: {
  supa: SupabaseClient;
  userId: string;
  feedId: string;
  action: string;
}) {
  const payGate = await getPayGateForAction(params.supa, params.feedId, params.action);
  if (payGate) {
    const lookupKey =
      typeof payGate.config.lookup_key === "string" ? payGate.config.lookup_key.trim() : "";
    if (!lookupKey) {
      throw new GateAccessError(400, "pay_gate_missing_lookup", "Pay gate is missing lookup key");
    }
    const ok = await hasEntitlement(params.userId, lookupKey);
    if (!ok) {
      throw new GateAccessError(402, "payment_required", "Payment required");
    }
  }

  const tokenGate = await getTokenGateForAction(params.supa, params.feedId, params.action);
  if (tokenGate) {
    throw new GateAccessError(501, "token_gate_not_implemented", "Token gate not implemented");
  }
}
