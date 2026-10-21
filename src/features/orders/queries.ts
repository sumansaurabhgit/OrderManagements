import "server-only";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Customer-facing order reads. They run as the signed-in user, so RLS limits
 * results to the caller's own orders; the explicit user_id filter keeps admins'
 * "My orders" view personal and lets Postgres use orders_user_created_idx.
 */

export async function listMyOrders(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, total_amount, created_at, order_items(quantity)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return data.map(({ order_items, ...order }) => ({
    ...order,
    item_count: order_items.reduce((sum, item) => sum + item.quantity, 0),
  }));
}

export async function getMyOrder(userId: string, orderId: string) {
  if (!z.uuid().safeParse(orderId).success) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, total_amount, created_at, stripe_payment_intent_id, stripe_checkout_url, checkout_expires_at, status_history, order_items(id, product_id, product_name, product_sku, quantity, unit_price)",
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load order: ${error.message}`);
  if (!data) return null;

  const checkoutStillOpen =
    data.status === "pending_payment" &&
    data.stripe_checkout_url !== null &&
    data.checkout_expires_at !== null &&
    new Date(data.checkout_expires_at).getTime() > Date.now();

  return { ...data, resume_checkout_url: checkoutStillOpen ? data.stripe_checkout_url : null };
}

export type MyOrder = NonNullable<Awaited<ReturnType<typeof getMyOrder>>>;
