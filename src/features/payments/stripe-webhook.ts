import "server-only";

import type Stripe from "stripe";
import { z } from "zod";

import { getStripe } from "@/lib/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type WebhookAction = "payment_succeeded" | "payment_failed" | "checkout_expired" | "refunded" | "partially_refunded";

type NormalizedEvent = {
  action: WebhookAction;
  orderId: string | null;
  sessionId: string | null;
  paymentIntentId: string | null;
  amount: number | null;
  currency: string | null;
  note: string | null;
};

const uuid = z.uuid();

function orderIdFrom(metadata: Stripe.Metadata | null | undefined, fallback: string | null = null): string | null {
  const candidate = metadata?.order_id ?? fallback;
  return candidate && uuid.safeParse(candidate).success ? candidate : null;
}

function idOf(reference: string | { id: string } | null): string | null {
  if (reference === null) return null;
  return typeof reference === "string" ? reference : reference.id;
}

/**
 * Maps the Stripe events we subscribe to onto business actions. Everything
 * else returns null and is acknowledged without being recorded.
 */
export function normalizeStripeEvent(event: Stripe.Event): NormalizedEvent | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Card-only sessions are always "paid" on completion; anything else
      // would be an asynchronous payment that has not settled yet.
      if (session.payment_status !== "paid") return null;
      return {
        action: "payment_succeeded",
        orderId: orderIdFrom(session.metadata, session.client_reference_id),
        sessionId: session.id,
        paymentIntentId: idOf(session.payment_intent),
        amount: session.amount_total,
        currency: session.currency,
        note: null,
      };
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      return {
        action: "checkout_expired",
        orderId: orderIdFrom(session.metadata, session.client_reference_id),
        sessionId: session.id,
        paymentIntentId: idOf(session.payment_intent),
        amount: null,
        currency: null,
        note: null,
      };
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      return {
        action: "payment_succeeded",
        orderId: orderIdFrom(intent.metadata),
        sessionId: null,
        paymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        note: null,
      };
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      return {
        action: "payment_failed",
        orderId: orderIdFrom(intent.metadata),
        sessionId: null,
        paymentIntentId: intent.id,
        amount: null,
        currency: null,
        note: intent.last_payment_error?.message ?? null,
      };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      return {
        action: charge.refunded ? "refunded" : "partially_refunded",
        orderId: orderIdFrom(charge.metadata),
        sessionId: null,
        paymentIntentId: idOf(charge.payment_intent),
        amount: charge.amount_refunded,
        currency: charge.currency,
        note: null,
      };
    }
    default:
      return null;
  }
}

const rpcResultSchema = z.object({
  idempotent_skip: z.boolean(),
  outcome: z.string(),
  order_id: z.uuid().optional(),
  order_status: z.string().optional(),
  follow_up: z.enum(["expire_checkout_session", "refund_late_payment"]).nullable().optional(),
  stripe_session_id: z.string().nullable().optional(),
  payment_intent_id: z.string().nullable().optional(),
});

export type WebhookResult =
  | { handled: false; eventType: string }
  | { handled: true; eventType: string; idempotent: boolean; outcome: string; orderId?: string; followUp?: string };

/**
 * Applies a verified Stripe event. The database call is a single transaction
 * that both records the event (idempotency gate) and applies its effect.
 * Follow-up Stripe calls are derived from the order's current state, so if one
 * fails we throw, Stripe redelivers, and the follow-up is retried even though
 * the event itself is already recorded.
 */
export async function processStripeEvent(event: Stripe.Event, payload: Json): Promise<WebhookResult> {
  const normalized = normalizeStripeEvent(event);
  if (!normalized) return { handled: false, eventType: event.type };

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("handle_stripe_webhook_atomic", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_action: normalized.action,
    p_order_id: normalized.orderId ?? undefined,
    p_stripe_session_id: normalized.sessionId ?? undefined,
    p_payment_intent_id: normalized.paymentIntentId ?? undefined,
    p_amount: normalized.amount ?? undefined,
    p_currency: normalized.currency ?? undefined,
    p_note: normalized.note ?? undefined,
    p_payload: payload,
  });
  if (error) throw new Error(`handle_stripe_webhook_atomic failed: ${error.message}`);

  const result = rpcResultSchema.parse(data);

  if (result.follow_up === "expire_checkout_session" && result.stripe_session_id) {
    // Older databases ask us to expire the session as soon as a card is
    // declined. Doing that replaces Stripe Checkout's decline message with
    // "You're all done here" and removes the back link while the customer is
    // still on the page. Leave the session open so they can read the decline,
    // try another card, or return to the shop. Reserved stock is released when
    // the session expires on its own, or when the customer or an admin cancels.
    console.info("[stripe-webhook] declined payment left the Checkout Session open", {
      orderId: result.order_id,
      sessionId: result.stripe_session_id,
    });
  }

  if (result.follow_up === "refund_late_payment" && result.payment_intent_id && result.order_id) {
    // Payment captured for an order that was already cancelled (stock released).
    const refund = await getStripe().refunds.create(
      {
        payment_intent: result.payment_intent_id,
        metadata: { order_id: result.order_id, reason: "payment_after_cancellation" },
      },
      { idempotencyKey: `late-payment-refund-${result.order_id}` },
    );
    const { error: recordError } = await admin.rpc("record_order_refund_request", {
      p_order_id: result.order_id,
      p_refund_id: refund.id,
    });
    if (recordError) throw new Error(`record_order_refund_request failed: ${recordError.message}`);
  }

  return {
    handled: true,
    eventType: event.type,
    idempotent: result.idempotent_skip,
    outcome: result.outcome,
    orderId: result.order_id,
    followUp: result.follow_up ?? undefined,
  };
}
