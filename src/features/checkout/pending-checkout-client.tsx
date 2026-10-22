"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { pushToast } from "@/components/toast-viewport";
import { cancelPendingCheckoutOrder } from "@/features/checkout/actions";
import { PENDING_CHECKOUT_COOKIE, PENDING_CHECKOUT_STORAGE_KEY } from "@/features/checkout/pending-checkout";
import { useCart } from "@/features/cart/cart-store";

const RELEASED_MESSAGE = "Checkout cancelled — your reserved stock has been released.";

function cookieValue(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(name.length + 1));
  return value || null;
}

export function readPendingCheckoutOrderId(): string | null {
  const stored = window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
  const fromCookie = cookieValue(PENDING_CHECKOUT_COOKIE);
  const id = stored || fromCookie;
  if (!id) return null;
  if (fromCookie && fromCookie !== stored) window.sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, fromCookie);
  return id;
}

export function forgetPendingCheckout() {
  window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
  document.cookie = `${PENDING_CHECKOUT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function cartSignature(lines: { productId: string; quantity: number }[]): string {
  return lines
    .map((line) => `${line.productId}:${line.quantity}`)
    .sort()
    .join("|");
}

/**
 * Releases a checkout reservation when the shopper changes the cart after
 * coming back from Stripe. Landing on the site without editing the cart
 * leaves the 30-minute hold in place.
 */
export function PendingCheckoutGuard() {
  const lines = useCart();
  const router = useRouter();
  const baseline = useRef<string | null>(null);
  const releasing = useRef(false);

  useEffect(() => {
    const signature = cartSignature(lines);
    const pendingId = readPendingCheckoutOrderId();
    if (!pendingId) {
      baseline.current = signature;
      return;
    }
    if (baseline.current === null) {
      baseline.current = signature;
      return;
    }
    if (baseline.current === signature || releasing.current) return;

    releasing.current = true;
    baseline.current = signature;
    void cancelPendingCheckoutOrder(pendingId).then((result) => {
      forgetPendingCheckout();
      releasing.current = false;
      if (result.ok && result.data.released) {
        pushToast({ message: RELEASED_MESSAGE, tone: "info" });
        router.refresh();
      }
    });
  }, [lines, router]);

  return null;
}

export function CheckoutCancelledToast({
  show,
  clearPending = false,
  refreshCatalog = false,
}: {
  show: boolean;
  clearPending?: boolean;
  refreshCatalog?: boolean;
}) {
  const router = useRouter();
  const shown = useRef(false);
  useEffect(() => {
    if (clearPending) forgetPendingCheckout();
    if (refreshCatalog) router.refresh();
    if (!show || shown.current) return;
    shown.current = true;
    pushToast({ message: RELEASED_MESSAGE, tone: "info" });
  }, [show, clearPending, refreshCatalog, router]);
  return null;
}
