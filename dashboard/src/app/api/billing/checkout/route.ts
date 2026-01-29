import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { ensureStripeCustomerId, getPayGateForAction, getStripe } from "@/lib/billing";

export const runtime = "nodejs";

type CheckoutPayload = {
  feed_id?: string;
  gate_action?: string;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function POST(request: Request) {
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

    const body = (await request.json().catch(() => ({}))) as CheckoutPayload;
    const feedId = typeof body.feed_id === "string" ? body.feed_id : "";
    const gateAction = typeof body.gate_action === "string" ? body.gate_action : "";

    if (!feedId || !gateAction) {
      return NextResponse.json({ error: "Missing feed or gate action" }, { status: 400 });
    }

    const payGate = await getPayGateForAction(feedId, gateAction);
    if (!payGate) {
      return NextResponse.json({ error: "No active pay gate for this action" }, { status: 404 });
    }

    const config = payGate.config ?? {};
    const priceId = typeof config.price_id === "string" ? config.price_id.trim() : "";
    const lookupKey = typeof config.lookup_key === "string" ? config.lookup_key.trim() : "";
    const billingMode = config.billing_mode === "subscription" ? "subscription" : "payment";

    if (!priceId || !lookupKey) {
      return NextResponse.json({ error: "Pay gate is missing Stripe configuration" }, { status: 400 });
    }

    const customerId = await ensureStripeCustomerId(data.user.id, data.user.email);
    const stripe = getStripe();
    const origin = getSiteUrl();

    const session = await stripe.checkout.sessions.create({
      mode: billingMode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/feeds?feed=${encodeURIComponent(feedId)}&checkout=success`,
      cancel_url: `${origin}/feeds?feed=${encodeURIComponent(feedId)}&checkout=cancel`,
      metadata: {
        feed_id: feedId,
        gate_action: gateAction,
        lookup_key: lookupKey,
        supabase_user_id: data.user.id
      }
    });

    if (!session.url) {
      return NextResponse.json({ error: "Unable to create checkout session" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Checkout failed" }, { status: 500 });
  }
}
