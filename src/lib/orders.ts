import { z } from "zod";

import type { Database } from "@/types/database";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Must match the limits enforced in create_order_and_reserve_stock(). */
export const MAX_LINE_QUANTITY = 20;
export const MAX_CART_LINES = 25;

export function formatOrderNumber(orderNumber: number): string {
  return `#${orderNumber}`;
}

const historyEntrySchema = z.object({
  kind: z.enum(["status_change", "note"]),
  status: z.enum(ORDER_STATUSES),
  timestamp: z.string(),
  actor: z.enum(["customer", "admin", "stripe", "system"]),
  actor_id: z.string().optional(),
  note: z.string().optional(),
  stripe_event_id: z.string().optional(),
});

export type OrderHistoryEntry = z.infer<typeof historyEntrySchema>;

/** status_history is JSONB; validate it at the boundary rather than casting. */
export function parseStatusHistory(value: unknown): OrderHistoryEntry[] {
  const parsed = z.array(historyEntrySchema).safeParse(value);
  if (!parsed.success) {
    console.error("[orders] malformed status_history", parsed.error.issues);
    return [];
  }
  return parsed.data;
}
