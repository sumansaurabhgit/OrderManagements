import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemsTable } from "@/components/order-items-table";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderControls } from "@/features/admin/order-controls";
import { getAdminOrder } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth";
import { formatOrderNumber, parseStatusHistory } from "@/lib/orders";

export const metadata: Metadata = { title: "Order details" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-2">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="break-all text-sm text-stone-900">{children}</dd>
    </div>
  );
}

function stripeDashboardUrl(path: string) {
  return `https://dashboard.stripe.com/test/${path}`;
}

export default async function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const formatDate = (value: string | null) => (value ? dateTime.format(new Date(value)) : "—");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm text-stone-500 hover:underline">
            ← Orders
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Order {formatOrderNumber(order.order_number)}</h1>
          <p className="font-mono text-xs text-stone-500">{order.id}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section aria-labelledby="customer-heading" className="space-y-3">
            <h2 id="customer-heading" className="text-lg font-semibold">
              Customer &amp; payment
            </h2>
            <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white px-5">
              <DetailRow label="Customer">
                {order.profiles?.display_name ? `${order.profiles.display_name} · ` : ""}
                {order.customer_email}
              </DetailRow>
              <DetailRow label="Customer ID">
                <span className="font-mono text-xs">{order.user_id}</span>
              </DetailRow>
              <DetailRow label="Checkout session">
                {order.stripe_session_id ? <span className="font-mono text-xs">{order.stripe_session_id}</span> : "—"}
              </DetailRow>
              <DetailRow label="Payment intent">
                {order.stripe_payment_intent_id ? (
                  <a
                    href={stripeDashboardUrl(`payments/${order.stripe_payment_intent_id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-emerald-800 underline"
                  >
                    {order.stripe_payment_intent_id}
                    <span className="sr-only"> (opens Stripe Dashboard in a new tab)</span>
                  </a>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Refund">
                {order.stripe_refund_id ? <span className="font-mono text-xs">{order.stripe_refund_id}</span> : "—"}
              </DetailRow>
              <DetailRow label="Created">{formatDate(order.created_at)}</DetailRow>
              <DetailRow label="Paid">{formatDate(order.paid_at)}</DetailRow>
              <DetailRow label="Fulfilled">{formatDate(order.fulfilled_at)}</DetailRow>
              <DetailRow label="Cancelled">{formatDate(order.cancelled_at)}</DetailRow>
              <DetailRow label="Refunded">{formatDate(order.refunded_at)}</DetailRow>
            </dl>
          </section>

          <section aria-labelledby="items-heading" className="space-y-3">
            <h2 id="items-heading" className="text-lg font-semibold">
              Line items
            </h2>
            <OrderItemsTable items={order.order_items} total={order.total_amount} />
          </section>
        </div>

        <div className="space-y-8">
          <section aria-labelledby="actions-heading" className="space-y-3">
            <h2 id="actions-heading" className="text-lg font-semibold">
              Actions
            </h2>
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <OrderControls orderId={order.id} status={order.status} refundPending={order.stripe_refund_id !== null} />
            </div>
          </section>

          <section aria-labelledby="timeline-heading" className="space-y-3">
            <h2 id="timeline-heading" className="text-lg font-semibold">
              Status timeline
            </h2>
            <OrderTimeline entries={parseStatusHistory(order.status_history)} showEventIds />
          </section>
        </div>
      </div>
    </div>
  );
}
