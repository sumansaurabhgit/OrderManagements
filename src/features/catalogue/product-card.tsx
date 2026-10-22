"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { cart, maxQuantityFor, useCart } from "@/features/cart/cart-store";
import { formatMoney } from "@/lib/money";

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    available_stock: number;
  };
  priority?: boolean;
};

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const lines = useCart();
  const inCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  const remaining = Math.max(0, maxQuantityFor(product.available_stock) - inCart);
  const soldOut = product.available_stock <= 0;
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 1400);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  function handleAdd() {
    const added = cart.add(
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        imageUrl: product.image_url,
        availableStock: product.available_stock,
      },
      1,
    );
    if (added > 0) setJustAdded(true);
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/70 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/products/${product.id}`} className="relative block overflow-hidden">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          framed={false}
          className="transition duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="absolute top-3 left-3 z-10 rounded-full shadow-sm backdrop-blur-md">
          <StockBadge available={product.available_stock} />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-medium tracking-tight text-zinc-900">
            <Link href={`/products/${product.id}`} className="hover:underline">
              {product.name}
            </Link>
          </h2>
          <p className="shrink-0 text-sm text-zinc-500">{formatMoney(product.price)}</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!justAdded && (soldOut || remaining === 0)}
          aria-live="polite"
          className={`mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            justAdded ? "bg-emerald-700 text-white" : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          {justAdded ? (
            <>
              <Check aria-hidden className="size-4" />
              Added
            </>
          ) : soldOut ? (
            "Sold out"
          ) : remaining === 0 ? (
            "In cart"
          ) : (
            "Add to cart"
          )}
        </button>
      </div>
    </article>
  );
}
