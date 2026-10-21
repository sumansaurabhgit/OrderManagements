import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { processStripeEvent } from "@/features/payments/stripe-webhook";
import { getStripeWebhookSecret } from "@/lib/server-env";
import { getStripe } from "@/lib/stripe";
import type { Json } from "@/types/database";

/**
 * Stripe webhook endpoint.
 *   400 — missing/invalid signature (never processed)
 *   200 — processed, replayed (idempotent no-op) or intentionally ignored
 *   500 — processing failed; Stripe retries with backoff
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
  }

  // The signature is computed over the exact raw bytes, so read text, not JSON.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    console.warn("[stripe-webhook] signature verification failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event, JSON.parse(rawBody) as Json);
    console.info("[stripe-webhook]", { eventId: event.id, ...result });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[stripe-webhook] processing failed", { eventId: event.id, type: event.type, error });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
