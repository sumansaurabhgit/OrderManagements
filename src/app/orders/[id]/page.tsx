import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemsTable } from "@/components/order-items-table";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderTimeline } from "@/components/order-timeline";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { CheckoutCancelledToast } from "@/features/checkout/pending-checkout-client";
import { releasePendingCheckoutOrder } from "@/features/checkout/release-pending";
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
  const returnedFromCheckout = searchParams.cancelled === "true";
  let releaseError: string | null = null;
  let clearedPendingCookie = false;
  let stockReleased = false;
  if (returnedFromCheckout) {
    const released = await releasePendingCheckoutOrder(id);
    if (!released.ok) releaseError = released.error;
    else {
      clearedPendingCookie = true;
      stockReleased = released.data.released;
    }
  }
  const order = await getMyOrder(user.id, id);
  if (!order) notFound();

  const isPending = order.status === "pending_payment";
  const expiresAt = order.checkout_expires_at ? new Date(order.checkout_expires_at) : null;
  const history = parseStatusHistory(order.status_history);
  const cardDeclined = history.some(
    (entry) => entry.actor === "stripe" && (entry.note?.includes("Payment attempt failed") ?? false),
  );

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

      {cardDeclined ? (
        <Alert tone="error">
          {isPending
            ? "Your card was declined, so the payment did not go through. You have not been charged. Try another card, or go back to the shop."
            : "Your card was declined and the payment did not go through. You have not been charged, and the reserved items have been released."}
        </Alert>
      ) : null}

      {returnedFromCheckout ? (
        <CheckoutCancelledToast
          show={order.status === "cancelled"}
          clearPending={clearedPendingCookie}
          refreshCatalog={stockReleased}
        />
      ) : null}
      {returnedFromCheckout && order.status === "cancelled" ? (
        <Alert tone="success">Checkout cancelled — your reserved stock has been released.</Alert>
      ) : null}

      {releaseError ? <Alert tone="error">{releaseError}</Alert> : null}

      {isPending && !cardDeclined && returnedFromCheckout && !releaseError ? (
        <Alert tone="warning">
          Checkout was cancelled before payment.
          {expiresAt ? ` Your items stay reserved until ${dateTime.format(expiresAt)}; ` : " "}
          resume payment or cancel the order to release them now.
        </Alert>
      ) : null}

      {cardDeclined && !isPending ? (
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          Back to shop
        </Link>
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
                {cardDeclined ? "Try another card" : "Complete payment"}
              </a>
            ) : null}
            <Link href="/" className={buttonClasses({ variant: "secondary" })}>
              Back to shop
            </Link>
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
          <OrderTimeline entries={history} />
        </section>
      </div>
    </div>
  );
}
