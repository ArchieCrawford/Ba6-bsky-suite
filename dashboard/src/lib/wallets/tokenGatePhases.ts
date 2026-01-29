export type TokenGatePhase = "A_VERIFY" | "B_BALANCE" | "C_TX";

export type VerificationPayload = {
  chain: "evm" | "solana";
  address: string;
  signature: string;
  nonce: string;
};

export type BalanceCheckRequest = {
  chain: "evm" | "solana";
  address: string;
  tokenAddress?: string;
  mintAddress?: string;
};

export type BalanceCheckResult =
  | { ok: true; balance: string }
  | { ok: false; reason: "not_implemented" | "rpc_missing" | "request_failed" };

export async function checkBalanceStub(_req: BalanceCheckRequest): Promise<BalanceCheckResult> {
  return { ok: false, reason: "not_implemented" };
}
