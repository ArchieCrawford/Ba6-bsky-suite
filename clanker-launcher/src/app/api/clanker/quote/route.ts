import { NextResponse } from "next/server";
import { LaunchRequestSchema } from "@/lib/launchSchema";
import { computeCreationFeeUsd, estimateGasUsd } from "@/lib/fees";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = LaunchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const creationFeeUsd = computeCreationFeeUsd(parsed.data);
    const estimatedGasUsd = estimateGasUsd(parsed.data);
    const totalUsd = Math.round((creationFeeUsd + estimatedGasUsd) * 100) / 100;

    return NextResponse.json({
      ok: true,
      creationFeeUsd,
      estimatedGasUsd,
      totalUsd,
      disclaimer:
        "Local preview quote. Real deployment will use on-chain simulation + current gas prices."
    });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
