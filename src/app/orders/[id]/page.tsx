import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemsTable } from "@/components/order-items-table";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderTimeline } from "@/components/order-timeline";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { CancelOrderForm } from "@/features/orders/cancel-order-form";
import { getMyOrder } from "@/features/orders/queries";
import { requireAuth } from "@/lib/auth";
import { formatOrderNumber, parseStatusHistory } from "@/lib/orders";

export const metadata: Metadata = { title: "Order details" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const user = await requireAuth(`/orders/${id}`);
  const order = await getMyOrder(user.id, id);
  if (!order) notFound();

  const isPending = order.status === "pending_payment";
  const expiresAt = order.checkout_expires_at ? new Date(order.checkout_expires_at) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/orders" className="text-sm text-stone-500 hover:underline">
            ← My orders
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Order {formatOrderNumber(order.order_number)}</h1>
          <p className="text-sm text-stone-500">
            Placed <time dateTime={order.created_at}>{dateTime.format(new Date(order.created_at))}</time>
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {isPending && searchParams.cancelled === "true" ? (
        <Alert tone="warning">
          Checkout was cancelled before payment.
          {expiresAt ? ` Your items stay reserved until ${dateTime.format(expiresAt)}; ` : " "}
          resume payment or cancel the order to release them now.
        </Alert>
      ) : null}

      {isPending ? (
        <section aria-labelledby="payment-heading" className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 id="payment-heading" className="font-semibold text-amber-900">
            Awaiting payment
          </h2>
          <p className="text-sm text-amber-900">
            Stock is reserved for this order until the checkout session expires. The order is confirmed only once
            Stripe notifies us that the payment succeeded.
          </p>
          <div className="flex flex-wrap items-start gap-3">
            {order.resume_checkout_url ? (
              <a href={order.resume_checkout_url} className={buttonClasses()}>
                Complete payment
              </a>
            ) : null}
            <CancelOrderForm orderId={order.id} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="items-heading" className="space-y-3">
          <h2 id="items-heading" className="text-lg font-semibold">
            Items
          </h2>
          <OrderItemsTable items={order.order_items} total={order.total_amount} />
          {order.stripe_payment_intent_id ? (
            <p className="text-sm text-stone-600">
              Payment reference: <span className="font-mono">{order.stripe_payment_intent_id}</span>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="timeline-heading" className="space-y-3">
          <h2 id="timeline-heading" className="text-lg font-semibold">
            Status history
          </h2>
          <OrderTimeline entries={parseStatusHistory(order.status_history)} />
        </section>
      </div>
    </div>
  );
}
