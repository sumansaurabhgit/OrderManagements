import type { Metadata } from "next";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { listMyOrders } from "@/features/orders/queries";
import { requireAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orders";

export const metadata: Metadata = { title: "My orders" };

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function MyOrdersPage() {
  const user = await requireAuth("/orders");
  const orders = await listMyOrders(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">My orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-stone-700">You haven&apos;t placed any orders yet.</p>
          <Link href="/" className={`${buttonClasses()} mt-4`}>
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Your orders, newest first</caption>
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Items</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-medium text-emerald-800 underline underline-offset-2">
                      {formatOrderNumber(order.order_number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <time dateTime={order.created_at}>{date.format(new Date(order.created_at))}</time>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">{order.item_count}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(order.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
