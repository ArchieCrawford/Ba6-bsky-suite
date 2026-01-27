import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
  const nonce = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  return NextResponse.json({ nonce, expires_at: expiresAt });
}
