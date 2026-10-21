import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { listActiveProducts } from "@/features/catalogue/queries";
import { formatMoney } from "@/lib/money";

export default async function StorefrontPage() {
  const products = await listActiveProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shop</h1>
        <p className="mt-1 text-sm text-stone-600">Everyday goods, made to last. Stock levels update live.</p>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-stone-600">No products are available right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <li key={product.id}>
              <Link
                href={`/products/${product.id}`}
                className="group block rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <ProductImage
                  src={product.image_url}
                  alt={product.name}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  priority={index < 3}
                />
                <div className="mt-3 space-y-2 px-1 pb-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-medium text-stone-900 group-hover:underline">{product.name}</h2>
                    <p className="shrink-0 font-semibold">{formatMoney(product.price)}</p>
                  </div>
                  <StockBadge available={product.available_stock} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
