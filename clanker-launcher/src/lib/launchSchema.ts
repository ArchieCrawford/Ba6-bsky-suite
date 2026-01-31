import { z } from "zod";

export const LaunchRequestSchema = z.object({
  chain: z.string().min(1),
  name: z.string().min(2).max(32),
  symbol: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/),
  imageUrl: z.string().url().optional().or(z.literal("")),
  devBuyUsd: z.number().min(0).max(5000),
  ownershipAddress: z.string().min(10),
  notes: z.string().max(280).optional().or(z.literal(""))
});

export type LaunchRequest = z.infer<typeof LaunchRequestSchema>;

export const QuoteResponseSchema = z.object({
  ok: z.literal(true),
  creationFeeUsd: z.number(),
  estimatedGasUsd: z.number(),
  totalUsd: z.number(),
  disclaimer: z.string()
});

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

export const LaunchResponseSchema = z.object({
  ok: z.literal(true),
  tokenAddress: z.string(),
  deployTxHash: z.string(),
  transferTxHash: z.string(),
  receiptUrl: z.string().url()
});

export type LaunchResponse = z.infer<typeof LaunchResponseSchema>;
