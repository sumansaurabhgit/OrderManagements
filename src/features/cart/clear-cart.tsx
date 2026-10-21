"use client";

import { useEffect } from "react";

import { cart } from "@/features/cart/cart-store";

/** Empties the cart once the customer has returned from a completed Stripe Checkout. */
export function ClearCart() {
  useEffect(() => {
    cart.clear();
  }, []);
  return null;
}
