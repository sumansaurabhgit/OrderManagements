"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { LOW_STOCK_THRESHOLD } from "@/components/stock-badge";
import { ProductCard } from "@/features/catalogue/product-card";

type ShopProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  available_stock: number;
};

type StockFilter = "all" | "in" | "low";
type SortKey = "featured" | "price-asc" | "price-desc" | "availability";

export function ShopBrowser({ products }: { products: ShopProduct[] }) {
  const [filter, setFilter] = useState<StockFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");

  const inStockCount = products.filter((product) => product.available_stock > 0).length;
  const lowStockCount = products.filter(
    (product) => product.available_stock > 0 && product.available_stock <= LOW_STOCK_THRESHOLD,
  ).length;
  const unitsAvailable = products.reduce((sum, product) => sum + product.available_stock, 0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (filter === "in" && product.available_stock <= 0) return false;
      if (filter === "low" && (product.available_stock <= 0 || product.available_stock > LOW_STOCK_THRESHOLD)) return false;
      if (needle && !product.name.toLowerCase().includes(needle)) return false;
      return true;
    });

    if (sort === "featured") return filtered;
    const ranked = [...filtered];
    if (sort === "price-asc") ranked.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") ranked.sort((a, b) => b.price - a.price);
    if (sort === "availability") ranked.sort((a, b) => b.available_stock - a.available_stock);
    return ranked;
  }, [products, filter, query, sort]);

  return (
    <div>
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-8 text-white shadow-lg sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.16), transparent 32%), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "auto, 28px 28px, 28px 28px",
          }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-zinc-300">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              CURATED COLLECTION • REAL-TIME STOCK
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everyday goods, crafted to last.</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-300 sm:text-base">
              Browse our collection with live inventory tracking. Stock levels update in real time and reserve automatically at checkout.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="Total Products" value={products.length} />
            <Stat label="Ready to Ship" value={inStockCount} />
            <Stat label="Total Units Available" value={unitsAvailable} />
          </dl>
        </div>
      </section>

      <div className="sticky top-28 z-30 mb-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by stock">
          <FilterTab pressed={filter === "all"} onClick={() => setFilter("all")} label="All Products" count={products.length} />
          <FilterTab pressed={filter === "in"} onClick={() => setFilter("in")} label="In Stock" count={inStockCount} />
          <FilterTab pressed={filter === "low"} onClick={() => setFilter("low")} label="Low Stock" count={lowStockCount} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block">
            <span className="sr-only">Search by product name</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by product name..."
              className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pr-3 pl-8 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 sm:w-64"
            />
          </label>
          <label className="block">
            <span className="sr-only">Sort products</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="w-full rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 sm:w-auto"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="availability">Availability</option>
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">No products match this view.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product, index) => (
            <li key={product.id}>
              <ProductCard product={product} priority={index < 4} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
      <dt className="text-[11px] text-zinc-300">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

function FilterTab({
  pressed,
  onClick,
  label,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        pressed ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
      }`}
    >
      {label} <span className={pressed ? "text-zinc-300" : "text-zinc-400"}>{count}</span>
    </button>
  );
}
