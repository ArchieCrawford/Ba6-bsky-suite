import { NextResponse } from "next/server";
import { getVeniceModels } from "@/lib/veniceModels";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const requestedType = new URL(request.url).searchParams.get("type");
    const type = requestedType === "text" ? "text" : "image";
    const models = await getVeniceModels({ type });
    return NextResponse.json({ models, type });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load models" }, { status: 500 });
  }
}
