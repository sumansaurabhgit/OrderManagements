"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/features/cart/cart-store";

export function CartLink() {
  const lines = useCart();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
    >
      <ShoppingBag aria-hidden className="size-4" />
      <span>Cart</span>
      <span className="sr-only">, {count} {count === 1 ? "item" : "items"}</span>
      {count > 0 ? (
        <span
          aria-hidden
          className="ml-0.5 rounded-full bg-emerald-700 px-1.5 py-0.5 text-xs font-semibold leading-none text-white"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
