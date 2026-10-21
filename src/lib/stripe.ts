import "server-only";

import Stripe from "stripe";

import { getStripeSecretKey } from "@/lib/server-env";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  stripeClient ??= new Stripe(getStripeSecretKey(), {
    apiVersion: "2026-09-30.endive",
    typescript: true,
    appInfo: { name: "order-management-system" },
  });
  return stripeClient;
}

export type CloseSessionResult = "expired" | "already_expired" | "completed";

/**
 * Makes a Checkout Session unpayable before its order is cancelled. Expiring
 * first is what prevents a "paid for a cancelled order" race: once Stripe
 * reports the session expired, no payment can complete on it.
 */
export async function closeCheckoutSession(sessionId: string): Promise<CloseSessionResult> {
  const stripe = getStripe();

  const statusOf = async (): Promise<CloseSessionResult | "open"> => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "complete") return "completed";
    if (session.status === "expired") return "already_expired";
    return "open";
  };

  const initial = await statusOf();
  if (initial !== "open") return initial;

  try {
    await stripe.checkout.sessions.expire(sessionId);
    return "expired";
  } catch (error) {
    // The session may have completed or expired between retrieve and expire.
    const status = await statusOf();
    if (status !== "open") return status;
    throw error;
  }
}
