"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cart, maxQuantityFor, useCart } from "@/features/cart/cart-store";

type AddToCartProps = {
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
    availableStock: number;
  };
};

export function AddToCart({ product }: AddToCartProps) {
  const lines = useCart();
  const inCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  const remaining = Math.max(0, maxQuantityFor(product.availableStock) - inCart);

  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  if (product.availableStock <= 0) {
    return (
      <Button disabled aria-disabled className="w-full sm:w-auto">
        Out of stock
      </Button>
    );
  }

  const effectiveQuantity = Math.min(Math.max(quantity, 1), Math.max(remaining, 1));

  function handleAdd() {
    const added = cart.add(
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        imageUrl: product.imageUrl,
        availableStock: product.availableStock,
      },
      effectiveQuantity,
    );
    setMessage(
      added > 0
        ? `Added ${added} × ${product.name} to your cart.`
        : "You already have the maximum available quantity in your cart.",
    );
    setQuantity(1);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-stone-800">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(remaining, 1)}
            value={effectiveQuantity}
            disabled={remaining === 0}
            onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
            aria-describedby="quantity-hint"
            className="block w-24 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <Button onClick={handleAdd} disabled={remaining === 0}>
          Add to cart
        </Button>
      </div>
      <p id="quantity-hint" className="text-xs text-stone-500">
        {remaining === 0
          ? "You have the maximum available quantity in your cart."
          : `You can add up to ${remaining} more${inCart ? ` (${inCart} already in your cart)` : ""}.`}
      </p>
      <p role="status" aria-live="polite" className="text-sm text-emerald-800">
        {message ? (
          <>
            {message}{" "}
            <Link href="/cart" className="font-medium underline underline-offset-2">
              View cart
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
