import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProductForm } from "@/features/admin/product-form";
import { getAdminProduct } from "@/features/admin/queries";
import { ProductActiveToggle, StockAdjustmentForm } from "@/features/admin/stock-forms";
import { requireAdmin } from "@/lib/auth";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Edit product" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const MOVEMENT_LABELS: Record<Database["public"]["Enums"]["stock_movement_type"], string> = {
  initial_stock: "Initial stock",
  order_reserved: "Order reserved",
  order_released: "Reservation released",
  order_refunded: "Refund restock",
  manual_adjustment: "Manual adjustment",
};

export default async function AdminProductPage(props: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const result = await getAdminProduct(id);
  if (!result) notFound();
  const { product, movements } = result;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/products" className="text-sm text-stone-500 hover:underline">
            ← Products
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
        </div>
        {product.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
      </div>

      {searchParams.created === "1" ? <Alert tone="success">Product created.</Alert> : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="details-heading" className="space-y-3">
          <h2 id="details-heading" className="text-lg font-semibold">
            Details
          </h2>
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <ProductForm product={product} />
          </div>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="stock-heading" className="space-y-3">
            <h2 id="stock-heading" className="text-lg font-semibold">
              Stock
            </h2>
            <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
              <p className="text-sm text-stone-600">
                On hand (available to sell): <span className="text-2xl font-semibold text-stone-900">{product.inventory?.on_hand ?? 0}</span>
              </p>
              <StockAdjustmentForm productId={product.id} />
            </div>
          </section>

          <section aria-labelledby="visibility-heading" className="space-y-3">
            <h2 id="visibility-heading" className="text-lg font-semibold">
              Visibility
            </h2>
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
              <p className="text-sm text-stone-600">
                Deactivated products are hidden from the storefront and cannot be purchased. Past orders keep their
                snapshotted details, so products are deactivated rather than deleted.
              </p>
              <ProductActiveToggle productId={product.id} isActive={product.is_active} />
            </div>
          </section>
        </div>
      </div>

      <section aria-labelledby="movements-heading" className="space-y-3">
        <h2 id="movements-heading" className="text-lg font-semibold">
          Stock movement log
        </h2>
        {movements.length === 0 ? (
          <p className="text-sm text-stone-600">No stock movements recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Most recent 50 stock movements for this product</caption>
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Delta</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">On hand after</th>
                  <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                  <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                  <th scope="col" className="px-4 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <time dateTime={movement.created_at}>{dateTime.format(new Date(movement.created_at))}</time>
                    </td>
                    <td className="px-4 py-3">{MOVEMENT_LABELS[movement.movement_type]}</td>
                    <td className={`px-4 py-3 text-right font-mono ${movement.delta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{movement.on_hand_after}</td>
                    <td className="px-4 py-3">{movement.reason}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {movement.reference && /^[0-9a-f-]{36}$/.test(movement.reference) ? (
                        <Link href={`/admin/orders/${movement.reference}`} className="text-emerald-800 underline">
                          Order {movement.reference.slice(0, 8)}…
                        </Link>
                      ) : (
                        movement.reference
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">{movement.profiles?.email ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
