import { NextResponse } from "next/server";
import { ethers } from "ethers";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type VerifyRequest = {
  chain?: string;
  address?: string;
  nonce?: string;
  message?: string;
  signature?: string;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function normalizeChain(input: string) {
  const lowered = input.trim().toLowerCase();
  if (lowered === "ethereum" || lowered === "eth" || lowered === "evm") return "evm";
  if (lowered === "solana" || lowered === "sol") return "solana";
  return null;
}

async function verifyEvm(message: string, signature: string, address: string) {
  const recovered = ethers.verifyMessage(message, signature);
  return ethers.getAddress(recovered) === ethers.getAddress(address);
}

function verifySolana(message: string, signature: string, address: string) {
  const messageBytes = new TextEncoder().encode(message);
  const sigBytes = bs58.decode(signature);
  const pubKeyBytes = bs58.decode(address);
  return nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes);
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const supa = createSupabaseServerClient(token);
    const { data, error: authError } = await supa.auth.getUser();
    if (authError || !data.user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as VerifyRequest;
    const chain = typeof body.chain === "string" ? normalizeChain(body.chain) : null;
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";

    if (!chain || !address || !nonce || !message || !signature) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!message.includes(nonce) || !message.includes(data.user.id)) {
      return NextResponse.json({ error: "Message does not match nonce or user" }, { status: 400 });
    }

    let valid = false;
    if (chain === "evm") {
      valid = await verifyEvm(message, signature, address);
    } else if (chain === "solana") {
      valid = verifySolana(message, signature, address);
    }

    if (!valid) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }

    const normalizedAddress = chain === "evm" ? ethers.getAddress(address) : address;

    const { data: existingDefault } = await supa
      .from("wallets")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("is_default", true)
      .maybeSingle();

    const { data: existingWallet } = await supa
      .from("wallets")
      .select("id,is_default")
      .eq("user_id", data.user.id)
      .eq("chain", chain)
      .eq("address", normalizedAddress)
      .maybeSingle();

    const shouldDefault = existingWallet?.is_default ?? !existingDefault?.id;

    const { data: wallet, error: walletError } = await supa
      .from("wallets")
      .upsert(
        {
          user_id: data.user.id,
          chain,
          address: normalizedAddress,
          is_default: shouldDefault,
          is_verified: true
        },
        { onConflict: "user_id,chain,address" }
      )
      .select("id")
      .single();

    if (walletError) {
      return NextResponse.json({ error: walletError.message ?? "Wallet upsert failed" }, { status: 500 });
    }

    const verifiedAt = new Date().toISOString();
    const { error: verifyError } = await supa.from("wallet_verifications").insert({
      wallet_id: wallet.id,
      nonce,
      message,
      signature,
      verified_at: verifiedAt
    });
    if (verifyError) {
      return NextResponse.json({ error: verifyError.message ?? "Verification insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, wallet_id: wallet.id, verified_at: verifiedAt });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Wallet verification failed" }, { status: 500 });
  }
}
