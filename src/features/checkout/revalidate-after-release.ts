import "server-only";

import { revalidatePath } from "next/cache";

/** Call only from Server Actions or Route Handlers after stock is released. */
export function revalidateAfterCheckoutRelease(orderId: string) {
  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}
