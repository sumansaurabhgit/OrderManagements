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
      className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow"
    >
      <ShoppingBag aria-hidden className="size-3.5" />
      <span>Cart</span>
      <span className="sr-only">, {count} {count === 1 ? "item" : "items"}</span>
      <span aria-hidden className="rounded-full bg-emerald-400 px-1.5 py-0.5 font-bold text-zinc-950">
        {count}
      </span>
    </Link>
  );
}
