import type { Metadata } from "next";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/order-status-badge";
import { StockBadge } from "@/components/stock-badge";
import { getDashboardData } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { formatOrderNumber, ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orders";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  await requireAdmin();
  const { statusCounts, lowStock, recentOrders } = await getDashboardData();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>

      <section aria-labelledby="status-heading">
        <h2 id="status-heading" className="mb-3 text-lg font-semibold">
          Orders by status
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ORDER_STATUSES.map((status) => (
            <li key={status}>
              <Link
                href={`/admin/orders?status=${status}`}
                className="block rounded-xl border border-stone-200 bg-white p-4 hover:shadow-sm"
              >
                <p className="text-sm text-stone-600">{ORDER_STATUS_LABELS[status]}</p>
                <p className="mt-1 text-2xl font-semibold">{statusCounts[status]}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="low-stock-heading" className="space-y-3">
          <h2 id="low-stock-heading" className="text-lg font-semibold">
            Low stock
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-stone-600">All active products are well stocked.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
              {lowStock.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link href={`/admin/products/${product.id}`} className="font-medium hover:underline">
                    {product.name}
                  </Link>
                  <StockBadge available={product.available_stock} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading" className="space-y-3">
          <h2 id="recent-heading" className="text-lg font-semibold">
            Recent orders
          </h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-stone-600">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                      {formatOrderNumber(order.order_number)}
                    </Link>
                    <p className="text-xs text-stone-500">{order.customer_email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatMoney(order.total_amount)}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
