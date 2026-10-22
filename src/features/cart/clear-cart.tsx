"use client";

import { useEffect } from "react";

import { cart } from "@/features/cart/cart-store";
import { forgetPendingCheckout } from "@/features/checkout/pending-checkout-client";

/** Empties the cart once the customer has returned from a completed Stripe Checkout. */
export function ClearCart() {
  useEffect(() => {
    forgetPendingCheckout();
    cart.clear();
  }, []);
  return null;
}
