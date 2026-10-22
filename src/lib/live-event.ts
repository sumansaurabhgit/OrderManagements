import { z } from "zod";

export const LIVE_EVENT_TYPES = ["product.created", "product.updated", "product.removed", "stock.updated"] as const;

export type LiveEventType = (typeof LIVE_EVENT_TYPES)[number];

export const liveEventSchema = z.object({
  id: z.number().int().positive(),
  type: z.enum(LIVE_EVENT_TYPES),
  message: z.string().min(1).max(200),
  productId: z.uuid().nullable(),
  at: z.string(),
});

export type LiveEvent = z.infer<typeof liveEventSchema>;

export function parseLiveEvent(raw: string): LiveEvent | null {
  try {
    const parsed = liveEventSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
