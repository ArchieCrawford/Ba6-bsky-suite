import { NextResponse } from "next/server";
import { LaunchRequestSchema } from "@/lib/clanker/launchSchema";

function randomHex(len: number) {
  const chars = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = LaunchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const isMock = process.env.MOCK_LAUNCH !== "0";

    if (isMock) {
      const tokenAddress = randomHex(40);
      const deployTxHash = randomHex(64);
      const transferTxHash = randomHex(64);

      return NextResponse.json({
        ok: true,
        tokenAddress,
        deployTxHash,
        transferTxHash,
        receiptUrl: "https://example.com/receipt/mock"
      });
    }

    // === Real deploy (placeholder) ===
    // Wire this to clanker-sdk once you’re ready:
    // - Create a viem wallet client from BA6 deployer key (in secure secret store)
    // - Use clanker-sdk deployToken(...) / simulateDeployToken(...)
    // - Parse deployed token address from receipt logs
    // - Transfer ownership to parsed.data.ownershipAddress
    // - Return real tx hashes + explorer links
    return NextResponse.json({ error: "Real deploy disabled. Set MOCK_LAUNCH=0 and implement deploy." }, { status: 501 });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
