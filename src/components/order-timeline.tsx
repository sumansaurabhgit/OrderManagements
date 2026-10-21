import { ORDER_STATUS_LABELS, type OrderHistoryEntry } from "@/lib/orders";

const ACTOR_LABELS: Record<OrderHistoryEntry["actor"], string> = {
  customer: "Customer",
  admin: "Admin",
  stripe: "Stripe",
  system: "System",
};

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

export function OrderTimeline({
  entries,
  showEventIds = false,
}: {
  entries: OrderHistoryEntry[];
  showEventIds?: boolean;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-stone-500">No history recorded.</p>;
  }

  return (
    <ol className="space-y-4 border-l border-stone-200 pl-5">
      {entries.map((entry, index) => (
        <li key={`${entry.timestamp}-${index}`} className="relative">
          <span
            aria-hidden
            className={`absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full ring-4 ring-stone-50 ${
              entry.kind === "status_change" ? "bg-emerald-600" : "bg-stone-400"
            }`}
          />
          <p className="text-sm font-medium text-stone-900">
            {entry.kind === "status_change" ? ORDER_STATUS_LABELS[entry.status] : "Update"}
            <span className="font-normal text-stone-500"> · {ACTOR_LABELS[entry.actor]}</span>
          </p>
          {entry.note ? <p className="text-sm text-stone-700">{entry.note}</p> : null}
          <p className="text-xs text-stone-500">
            <time dateTime={entry.timestamp}>{dateTime.format(new Date(entry.timestamp))}</time>
            {showEventIds && entry.stripe_event_id ? (
              <span className="font-mono"> · {entry.stripe_event_id}</span>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
}
