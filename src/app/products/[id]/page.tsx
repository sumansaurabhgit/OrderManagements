import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { AddToCart } from "@/features/cart/add-to-cart";
import { getActiveProduct } from "@/features/catalogue/queries";
import { formatMoney } from "@/lib/money";

export async function generateMetadata(props: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const product = await getActiveProduct(id);
  return { title: product?.name ?? "Product not found" };
}

export default async function ProductPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const product = await getActiveProduct(id);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <Link href="/" className="hover:underline">
          Shop
        </Link>{" "}
        / <span aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductImage src={product.image_url} alt={product.name} sizes="(min-width: 768px) 50vw, 100vw" priority />

        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
            <p className="mt-1 font-mono text-xs text-stone-500">SKU {product.sku}</p>
          </div>
          <p className="text-2xl font-semibold">{formatMoney(product.price)}</p>
          <StockBadge available={product.available_stock} />
          <p className="leading-relaxed text-stone-700">{product.description}</p>
          <AddToCart
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.image_url,
              availableStock: product.available_stock,
            }}
          />
        </div>
      </div>
    </div>
  );
}
