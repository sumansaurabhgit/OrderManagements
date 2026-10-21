import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { listStripeEvents } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth";
import { formatOrderNumber } from "@/lib/orders";

export const metadata: Metadata = { title: "Webhook events" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

export default async function AdminWebhooksPage() {
  await requireAdmin();
  const events = await listStripeEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Webhook events</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Every Stripe event that reached the webhook, keyed by its Stripe event id. Each event is applied exactly once;
          replays (for example <code className="font-mono">stripe events resend</code>) are counted as duplicates and do
          not change any order.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-stone-600">No webhook events received yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">The 100 most recent Stripe webhook events</caption>
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Received</th>
                <th scope="col" className="px-4 py-3 font-medium">Event</th>
                <th scope="col" className="px-4 py-3 font-medium">Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Duplicates ignored</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <time dateTime={event.processed_at}>{dateTime.format(new Date(event.processed_at))}</time>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{event.event_type}</span>
                    <span className="block font-mono text-xs text-stone-500">{event.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    {event.order_id && event.orders ? (
                      <Link href={`/admin/orders/${event.order_id}`} className="text-emerald-800 underline">
                        {formatOrderNumber(event.orders.order_number)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{event.outcome}</td>
                  <td className="px-4 py-3 text-right">
                    {event.duplicate_count > 0 ? <Badge tone="info">{event.duplicate_count}</Badge> : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
