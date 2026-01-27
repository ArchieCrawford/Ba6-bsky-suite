import { NextResponse } from "next/server";

export const runtime = "nodejs";

type VerifyPayload = {
  chain?: string;
  address?: string;
  signature?: string;
  nonce?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as VerifyPayload;
  return NextResponse.json({
    ok: false,
    reason: "not_implemented",
    received: {
      chain: body.chain ?? null,
      address: body.address ?? null,
      nonce: body.nonce ?? null
    }
  });
}
