"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { z } from "zod";

import { fail, ok, parseDbError, type ActionResult } from "@/lib/action-result";
import { getAdminOrNull } from "@/lib/auth";
import { closeCheckoutSession, getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OrderActionState = ActionResult | null;

const NOT_ADMIN = "You must be signed in as an administrator to do that.";

function revalidateOrder(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

/**
 * Manual transitions an admin may perform: paid -> fulfilled and
 * pending_payment -> cancelled. The database function re-checks the role and
 * the state machine; this action adds the Stripe side of a cancellation.
 */
export async function transitionOrder(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  if (!(await getAdminOrNull())) return fail(NOT_ADMIN);

  const parsed = z
    .object({
      orderId: z.uuid(),
      status: z.enum(["fulfilled", "cancelled"]),
      note: z.string().trim().max(500),
    })
    .safeParse({ orderId: formData.get("orderId"), status: formData.get("status"), note: formData.get("note") ?? "" });
  if (!parsed.success) return fail("Invalid request.");

  const { orderId, status, note } = parsed.data;
  const supabase = await createServerSupabaseClient();

  if (status === "cancelled") {
    const { data: order, error } = await supabase
      .from("orders")
      .select("status, stripe_session_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error) return fail(parseDbError(error, "load order for cancellation").message);
    if (!order) return fail("Order not found.");

    // Expire the Checkout Session first so the customer can no longer pay.
    if (order.status === "pending_payment" && order.stripe_session_id) {
      try {
        if ((await closeCheckoutSession(order.stripe_session_id)) === "completed") {
          return fail("The customer has just completed payment; wait for Stripe's confirmation instead of cancelling.");
        }
      } catch (stripeError) {
        console.error("[admin] failed to expire Checkout Session", { orderId, stripeError });
        return fail("Couldn't reach Stripe to close the checkout session, so the order was not cancelled. Try again.");
      }
    }
  }

  const { error } = await supabase.rpc("admin_transition_order_status", {
    p_order_id: orderId,
    p_new_status: status,
    p_note: note || undefined,
  });
  if (error) return fail(parseDbError(error, "admin_transition_order_status").message);

  revalidateOrder(orderId);
  return ok(null, status === "fulfilled" ? "Order marked as fulfilled." : "Order cancelled and reserved stock released.");
}

/**
 * Full refund through the Stripe API. The order is NOT marked refunded here:
 * Stripe's charge.refunded webhook performs that transition (and restocks), so
 * refunds issued from the Stripe Dashboard follow the exact same path.
 */
export async function refundOrder(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  if (!(await getAdminOrNull())) return fail(NOT_ADMIN);

  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Invalid request.");

  const supabase = await createServerSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, stripe_payment_intent_id, stripe_refund_id")
    .eq("id", orderId.data)
    .maybeSingle();
  if (error) return fail(parseDbError(error, "load order for refund").message);
  if (!order) return fail("Order not found.");
  if (order.status !== "paid") return fail("Only paid orders that have not been fulfilled can be refunded.");
  if (order.stripe_refund_id) return fail("A refund has already been requested for this order.");
  if (!order.stripe_payment_intent_id) return fail("This order has no Stripe payment to refund.");

  let refundId: string;
  try {
    const refund = await getStripe().refunds.create(
      { payment_intent: order.stripe_payment_intent_id, metadata: { order_id: order.id } },
      // Double-clicks and retries resolve to the same refund.
      { idempotencyKey: `admin-refund-${order.id}` },
    );
    refundId = refund.id;
  } catch (stripeError) {
    if (stripeError instanceof Stripe.errors.StripeError && stripeError.code === "charge_already_refunded") {
      return fail("Stripe reports this payment is already refunded; the status will update when the webhook arrives.");
    }
    console.error("[admin] Stripe refund failed", { orderId: order.id, stripeError });
    return fail(
      stripeError instanceof Stripe.errors.StripeError
        ? `Stripe rejected the refund: ${stripeError.message}`
        : "Couldn't reach Stripe to create the refund. Please try again.",
    );
  }

  const { error: recordError } = await supabase.rpc("record_order_refund_request", {
    p_order_id: order.id,
    p_refund_id: refundId,
  });
  if (recordError) {
    // The refund exists in Stripe; the webhook will still complete the transition.
    console.error("[admin] refund created but not recorded", { orderId: order.id, refundId, recordError });
  }

  revalidateOrder(order.id);
  return ok(null, `Refund ${refundId} requested. The order will show as refunded once Stripe confirms it.`);
}
