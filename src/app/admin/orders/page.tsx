import type { Metadata } from "next";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { ADMIN_PAGE_SIZE, listAdminOrders, parseAdminOrderFilters } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { formatOrderNumber, ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  await requireAdmin();
  const filters = parseAdminOrderFilters(await props.searchParams);
  const { orders, total } = await listAdminOrders(filters);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.query) params.set("q", filters.query);
    params.set("page", String(page));
    return `/admin/orders?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>

      <form method="get" role="search" aria-label="Filter orders" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-stone-800">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="block rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-64 flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-stone-800">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.query}
            placeholder="Order ID, order number (e.g. 1001) or customer email"
            className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className={buttonClasses()}>
          Apply
        </button>
        {filters.status || filters.query ? (
          <Link href="/admin/orders" className={buttonClasses({ variant: "ghost" })}>
            Clear
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-stone-600" aria-live="polite">
        {total} {total === 1 ? "order" : "orders"} found
      </p>

      {orders.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Orders, newest first</caption>
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-emerald-800 underline underline-offset-2">
                      {formatOrderNumber(order.order_number)}
                    </Link>
                    <span className="block font-mono text-xs text-stone-500">{order.id.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-3">{order.customer_email}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <time dateTime={order.created_at}>{dateTime.format(new Date(order.created_at))}</time>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(order.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {filters.page > 1 ? (
            <Link href={pageHref(filters.page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-stone-600">
            Page {filters.page} of {pageCount}
          </p>
          {filters.page < pageCount ? (
            <Link href={pageHref(filters.page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
