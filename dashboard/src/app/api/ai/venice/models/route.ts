import { NextResponse } from "next/server";
import { getVeniceModels } from "@/lib/veniceModels";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = await getVeniceModels();
    return NextResponse.json({ models });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load models" }, { status: 500 });
  }
}
