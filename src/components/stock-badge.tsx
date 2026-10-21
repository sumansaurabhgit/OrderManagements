import { Badge } from "@/components/ui/badge";

export const LOW_STOCK_THRESHOLD = 3;

export function StockBadge({ available }: { available: number }) {
  if (available <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (available === 1) return <Badge tone="warning">Only 1 left!</Badge>;
  if (available <= LOW_STOCK_THRESHOLD) return <Badge tone="warning">Only {available} left</Badge>;
  return <Badge tone="success">In stock: {available} available</Badge>;
}
