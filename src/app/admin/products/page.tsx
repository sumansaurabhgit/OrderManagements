import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { listAdminProducts } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await listAdminProducts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
        <Link href="/admin/products/new" className={buttonClasses()}>
          New product
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">All products, including inactive ones</caption>
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">SKU</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">On hand</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${product.id}`} className="font-medium text-emerald-800 underline underline-offset-2">
                    {product.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
                <td className="px-4 py-3 text-right">{formatMoney(product.price)}</td>
                <td className="px-4 py-3 text-right font-medium">{product.inventory?.on_hand ?? 0}</td>
                <td className="px-4 py-3">
                  {product.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
