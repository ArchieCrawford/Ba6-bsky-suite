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

export async function getPayGateForAction(
  supa: SupabaseClient,
  targetId: string,
  action: string,
  targetType: "feed" | "space" = "feed"
) {
  const targetColumn = targetType === "space" ? "space_id" : "feed_id";
  const { data, error } = await supa
    .from("feed_gates")
    .select("id,gate_type,config,is_enabled")
    .eq(targetColumn, targetId)
    .eq("target_type", targetType)
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

export async function getTokenGateForAction(
  supa: SupabaseClient,
  targetId: string,
  action: string,
  targetType: "feed" | "space" = "feed"
) {
  const targetColumn = targetType === "space" ? "space_id" : "feed_id";
  const { data, error } = await supa
    .from("feed_gates")
    .select("id,gate_type,config,is_enabled")
    .eq(targetColumn, targetId)
    .eq("target_type", targetType)
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
  targetId: string;
  targetType?: "feed" | "space";
  action: string;
}) {
  const targetType = params.targetType ?? "feed";
  const payGate = await getPayGateForAction(params.supa, params.targetId, params.action, targetType);
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

  const tokenGate = await getTokenGateForAction(params.supa, params.targetId, params.action, targetType);
  if (tokenGate) {
    const { data: wallets } = await params.supa
      .from("wallets")
      .select("id")
      .eq("user_id", params.userId);
    const walletIds = (wallets ?? []).map((row: any) => row.id);
    if (!walletIds.length) {
      throw new GateAccessError(401, "wallet_required", "Connect a wallet to continue");
    }
    const { data: verified } = await params.supa
      .from("wallet_verifications")
      .select("id,verified_at")
      .in("wallet_id", walletIds)
      .not("verified_at", "is", null)
      .limit(1);
    if (!verified || verified.length === 0) {
      throw new GateAccessError(403, "wallet_not_verified", "Verify your wallet to continue");
    }
    throw new GateAccessError(501, "token_gate_not_implemented", "Token gate not implemented");
  }
}
