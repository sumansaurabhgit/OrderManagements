"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { ProductImage } from "@/components/product-image";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { cart, maxQuantityFor, useCart } from "@/features/cart/cart-store";
import { startCheckout } from "@/features/checkout/actions";
import { formatMoney } from "@/lib/money";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const STOCK_ERROR_CODES = new Set(["INSUFFICIENT_STOCK", "PRODUCT_UNAVAILABLE"]);

/** Re-reads price and stock for every cart line from the live catalogue. */
async function refreshCartFromCatalogue(productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await getBrowserSupabaseClient()
    .from("products")
    .select("id, name, price, image_url, available_stock")
    .in("id", productIds)
    .eq("is_active", true);
  if (error) throw error;
  return cart.reconcile(data);
}

export function CartView({ isSignedIn }: { isSignedIn: boolean }) {
  const lines = useCart();
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Refresh once on mount so stale prices / stock are corrected before checkout.
  useEffect(() => {
    let active = true;
    const ids = cart.productIds();
    refreshCartFromCatalogue(ids)
      .then((changes) => {
        if (active && changes.length) setNotices(changes);
      })
      .catch(() => {
        if (active) setError("We couldn't refresh stock levels. Prices and availability will be checked at checkout.");
      });
    return () => {
      active = false;
    };
  }, []);

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  function handleCheckout() {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout(
        lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      );
      // A successful checkout redirects to Stripe and never returns a result.
      if (!result || result.ok) return;
      setError(result.error);
      if (result.code && STOCK_ERROR_CODES.has(result.code)) {
        setNotices(await refreshCartFromCatalogue(cart.productIds()));
      }
    });
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="text-stone-700">Your cart is empty.</p>
        <Link href="/" className={`${buttonClasses()} mt-4`}>
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="cart-items-heading" className="space-y-4">
        <h2 id="cart-items-heading" className="sr-only">
          Items in your cart
        </h2>
        {notices.length > 0 ? (
          <Alert tone="warning">
            <ul className="list-disc space-y-1 pl-4">
              {notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {lines.map((line) => {
            const max = maxQuantityFor(line.availableStock);
            const inputId = `qty-${line.productId}`;
            return (
              <li key={line.productId} className="flex flex-wrap items-center gap-4 p-4">
                <div className="w-20 shrink-0">
                  <ProductImage src={line.imageUrl} alt="" sizes="80px" />
                </div>
                <div className="min-w-40 flex-1">
                  <Link href={`/products/${line.productId}`} className="font-medium hover:underline">
                    {line.name}
                  </Link>
                  <p className="text-sm text-stone-600">{formatMoney(line.unitPrice)} each</p>
                  <p className="text-xs text-stone-500">{line.availableStock} available</p>
                </div>
                <div>
                  <label htmlFor={inputId} className="sr-only">
                    Quantity of {line.name}
                  </label>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={max}
                    value={line.quantity}
                    onChange={(event) =>
                      cart.setQuantity(line.productId, Number.parseInt(event.target.value, 10) || 1)
                    }
                    className="w-20 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <p className="w-24 text-right font-medium">{formatMoney(line.unitPrice * line.quantity)}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cart.remove(line.productId)}
                  aria-label={`Remove ${line.name} from cart`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <aside aria-labelledby="summary-heading" className="h-fit space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 id="summary-heading" className="text-lg font-semibold">
          Order summary
        </h2>
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">{formatMoney(subtotal)}</span>
        </div>
        <p className="text-xs text-stone-500">
          Prices and stock are confirmed when you check out. Items stay reserved for 30 minutes while you pay, and are
          released immediately if you leave checkout or change this cart.
        </p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {isSignedIn ? (
          <Button className="w-full" onClick={handleCheckout} disabled={isPending} aria-busy={isPending}>
            {isPending ? "Redirecting to secure checkout…" : "Checkout"}
          </Button>
        ) : (
          <Link href="/login?next=/cart" className={buttonClasses({ className: "w-full" })}>
            Sign in to check out
          </Link>
        )}
      </aside>
    </div>
  );
}
