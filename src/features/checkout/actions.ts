"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { z } from "zod";

import { fail, ok, parseDbError, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "@/lib/orders";
import { closeCheckoutSession, getStripe } from "@/lib/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Stripe's minimum session lifetime is 30 minutes; one extra minute absorbs clock skew. */
const CHECKOUT_SESSION_TTL_SECONDS = 31 * 60;

const checkoutItemsSchema = z
  .array(
    z.object({
      productId: z.uuid(),
      quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
    }),
  )
  .min(1)
  .max(MAX_CART_LINES);

export type CheckoutItem = z.infer<typeof checkoutItemsSchema>[number];

const reservationSchema = z.object({
  order_id: z.uuid(),
  order_number: z.number().int(),
  total_amount: z.number().int(),
  currency: z.string(),
  customer_email: z.string(),
  items: z.array(
    z.object({
      product_id: z.uuid(),
      name: z.string(),
      sku: z.string(),
      unit_price: z.number().int(),
      quantity: z.number().int(),
    }),
  ),
});

/**
 * Checkout. The client sends only product ids and quantities; the database
 * function locks stock, validates availability and prices every line from the
 * products table, so the Stripe amount can never come from the browser.
 */
export async function startCheckout(items: CheckoutItem[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cart");

  const parsed = checkoutItemsSchema.safeParse(items);
  if (!parsed.success) {
    return fail("Your cart contains invalid items. Please refresh the page and try again.", { code: "INVALID_CART" });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_order_and_reserve_stock", {
    p_items: parsed.data.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
  });
  if (error) {
    const { code, message } = parseDbError(error, "create_order_and_reserve_stock");
    return fail(message, { code });
  }

  const reservation = reservationSchema.parse(data);
  const orderId = reservation.order_id;
  const appUrl = getAppUrl();
  const metadata = { order_id: orderId, order_number: String(reservation.order_number) };

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        customer_email: reservation.customer_email,
        client_reference_id: orderId,
        metadata,
        // Copied onto the PaymentIntent so payment_intent.* and charge.*
        // events can be traced back to the order.
        payment_intent_data: {
          metadata,
          description: `Larkspur Goods order #${reservation.order_number}`,
        },
        line_items: reservation.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: reservation.currency,
            unit_amount: item.unit_price,
            product_data: { name: item.name, metadata: { sku: item.sku, product_id: item.product_id } },
          },
        })),
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
        success_url: `${appUrl}/orders/${orderId}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/orders/${orderId}?cancelled=true`,
      },
      { idempotencyKey: `checkout-session-${orderId}` },
    );
    if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");
  } catch (stripeError) {
    console.error("[checkout] Stripe session creation failed", { orderId, stripeError });
    // Compensate: no session exists, so no expiry webhook would ever release
    // this reservation. Release it now in the same request.
    const { error: releaseError } = await supabase.rpc("cancel_own_pending_order", {
      p_order_id: orderId,
      p_reason: "checkout_unavailable",
    });
    if (releaseError) {
      console.error("[checkout] CRITICAL: failed to release reservation", { orderId, releaseError });
    }
    return fail("We couldn't start the payment, so nothing was reserved or charged. Please try again.", {
      code: "PAYMENT_PROVIDER_ERROR",
    });
  }

  const { error: attachError } = await createAdminSupabaseClient().rpc("attach_checkout_session", {
    p_order_id: orderId,
    p_session_id: session.id,
    p_checkout_url: session.url,
    p_expires_at: new Date(session.expires_at * 1000).toISOString(),
  });
  if (attachError) {
    // Not fatal: webhooks resolve the order from session metadata.
    console.error("[checkout] failed to store the Checkout Session on the order", { orderId, attachError });
  }

  redirect(session.url);
}

export type CancelOrderState = ActionResult | null;

/** Customer cancels their own unpaid order, releasing the reserved stock. */
export async function cancelMyOrder(_prev: CancelOrderState, formData: FormData): Promise<CancelOrderState> {
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Order not found.");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${orderId.data}`);

  const supabase = await createServerSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, stripe_session_id")
    .eq("id", orderId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[checkout] failed to load order for cancellation", error);
    return fail("We couldn't load this order. Please try again.");
  }
  if (!order) return fail("Order not found.");
  if (order.status !== "pending_payment") return fail("Only unpaid orders can be cancelled.");

  // Close the Stripe session first so it can no longer be paid.
  if (order.stripe_session_id) {
    try {
      const result = await closeCheckoutSession(order.stripe_session_id);
      if (result === "completed") {
        return fail("Your payment has already gone through and is being confirmed. Refresh in a moment.");
      }
    } catch (stripeError) {
      console.error("[checkout] failed to expire Checkout Session", { orderId: order.id, stripeError });
      return fail("We couldn't reach the payment provider to cancel this checkout. Please try again.");
    }
  }

  const { error: cancelError } = await supabase.rpc("cancel_own_pending_order", {
    p_order_id: order.id,
    p_reason: "customer_cancelled",
  });
  if (cancelError) return fail(parseDbError(cancelError, "cancel_own_pending_order").message);

  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/orders");
  return ok(null, "Your order was cancelled and the reserved items were released.");
}
