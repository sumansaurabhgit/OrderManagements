import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemsTable } from "@/components/order-items-table";
import { buttonClasses } from "@/components/ui/button";
import { ClearCart } from "@/features/cart/clear-cart";
import { OrderStatusPoller } from "@/features/orders/order-status-poller";
import { getMyOrder } from "@/features/orders/queries";
import { requireAuth } from "@/lib/auth";
import { formatOrderNumber, ORDER_STATUS_LABELS } from "@/lib/orders";

export const metadata: Metadata = { title: "Order confirmation" };

/**
 * Stripe's success_url. This page only READS the order status: an order
 * becomes "paid" exclusively through the verified webhook, never because the
 * customer was redirected here (the session_id query param is ignored).
 */
export default async function OrderConfirmationPage(props: PageProps<"/orders/[id]/confirmation">) {
  const { id } = await props.params;
  const user = await requireAuth(`/orders/${id}/confirmation`);
  const order = await getMyOrder(user.id, id);
  if (!order) notFound();

  const confirmed = order.status === "paid" || order.status === "fulfilled";
  const pending = order.status === "pending_payment";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ClearCart />

      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        {confirmed ? (
          <>
            <CheckCircle2 aria-hidden className="mx-auto size-10 text-emerald-600" />
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Thank you — your order is confirmed</h1>
            <p className="mt-1 text-sm text-stone-600">
              Order {formatOrderNumber(order.order_number)} has been paid. We&apos;ll prepare it for dispatch.
            </p>
          </>
        ) : pending ? (
          <>
            <Clock aria-hidden className="mx-auto size-10 text-amber-600" />
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Confirming your payment</h1>
            <p className="mt-1 text-sm text-stone-600">
              Order {formatOrderNumber(order.order_number)} will be confirmed as soon as Stripe notifies us.
            </p>
            <div className="mt-4">
              <OrderStatusPoller />
            </div>
          </>
        ) : (
          <>
            <XCircle aria-hidden className="mx-auto size-10 text-stone-500" />
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Order {formatOrderNumber(order.order_number)}: {ORDER_STATUS_LABELS[order.status]}
            </h1>
            <p className="mt-1 text-sm text-stone-600">See the order page for the full status history.</p>
          </>
        )}
      </div>

      <OrderItemsTable items={order.order_items} total={order.total_amount} />

      <div className="flex flex-wrap gap-3">
        <Link href={`/orders/${order.id}`} className={buttonClasses({ variant: "secondary" })}>
          View order details
        </Link>
        <Link href="/" className={buttonClasses()}>
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
