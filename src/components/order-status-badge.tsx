import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";

const TONES: Record<OrderStatus, BadgeTone> = {
  pending_payment: "warning",
  paid: "success",
  fulfilled: "info",
  cancelled: "neutral",
  refunded: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
