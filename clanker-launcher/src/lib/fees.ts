import type { LaunchRequest } from "./launchSchema";

export function computeCreationFeeUsd(req: LaunchRequest) {
  const base = 49;
  const devBuyBump = req.devBuyUsd > 0 ? Math.min(25, Math.round(req.devBuyUsd * 0.01)) : 0;
  return base + devBuyBump;
}

export function estimateGasUsd(req: LaunchRequest) {
  const chainFactor = req.chain.toLowerCase().includes("base") ? 1 : 1.15;
  const complexity = 1 + Math.min(0.25, req.devBuyUsd / 2000);
  return Math.round(18 * chainFactor * complexity);
}
