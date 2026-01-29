import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const DOMAIN = "ba6-bsky-suite.com";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supa = createSupabaseServerClient(token);
    const { data, error } = await supa.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const nonce = randomBytes(16).toString("hex");
    const timestamp = new Date().toISOString();
    const message = [
      "BA6 Wallet Verification",
      `Domain: ${DOMAIN}`,
      `User: ${data.user.id}`,
      `Nonce: ${nonce}`,
      `Time: ${timestamp}`
    ].join("\n");

    return NextResponse.json({ nonce, message });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to create nonce" }, { status: 500 });
  }
}
