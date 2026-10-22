import "server-only";

import { z } from "zod";

import { fail, ok, parseDbError, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { closeCheckoutSession } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const RELEASED_MESSAGE = "Checkout cancelled — your reserved stock has been released.";

/**
 * Cancels an unpaid checkout and releases stock. Safe to call from Server
 * Components (e.g. Stripe cancel_url). Does not touch cookies — use
 * `cancelPendingCheckoutOrder` from a Server Action or clear
 * `forgetPendingCheckout()` on the client.
 */
export async function releasePendingCheckoutOrder(
  orderId: string,
): Promise<ActionResult<{ released: boolean }>> {
  const parsed = z.uuid().safeParse(orderId);
  if (!parsed.success) return fail("Order not found.");

  const user = await getCurrentUser();
  if (!user) return fail("Please sign in to update this checkout.");

  const supabase = await createServerSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, stripe_session_id")
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[checkout] failed to load order for stock release", error);
    return fail("We couldn't load this checkout. Please try again.");
  }
  if (!order || order.status !== "pending_payment") {
    return ok({ released: false });
  }

  if (order.stripe_session_id) {
    try {
      const result = await closeCheckoutSession(order.stripe_session_id);
      if (result === "completed") {
        return ok({ released: false });
      }
    } catch (stripeError) {
      console.error("[checkout] failed to expire Checkout Session", { orderId: order.id, stripeError });
      return fail("We couldn't reach the payment provider to cancel this checkout. Please try again.");
    }
  }

  const { error: cancelError } = await supabase.rpc("cancel_own_pending_order", {
    p_order_id: order.id,
    p_reason: "checkout_abandoned",
  });
  if (cancelError) {
    const parsedError = parseDbError(cancelError, "cancel_own_pending_order");
    if (parsedError.code === "INVALID_STATUS_TRANSITION") {
      return ok({ released: false });
    }
    return fail(parsedError.message);
  }

  return ok({ released: true }, RELEASED_MESSAGE);
}
