import "server-only";

import { z } from "zod";

import { LOW_STOCK_THRESHOLD } from "@/components/stock-badge";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/*
 * Admin reads use the signed-in user's client, not the service role: the
 * admin RLS policies are what grant visibility, so a non-admin session gets
 * nothing back even if it somehow reached these functions.
 */

export const ADMIN_PAGE_SIZE = 20;

export async function getDashboardData() {
  const supabase = await createServerSupabaseClient();

  const statusCounts = await Promise.all(
    ORDER_STATUSES.map(async (status) => {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) throw new Error(`Failed to count orders: ${error.message}`);
      return [status, count ?? 0] as const;
    }),
  );

  const [lowStock, recentOrders] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, available_stock, is_active")
      .lte("available_stock", LOW_STOCK_THRESHOLD)
      .eq("is_active", true)
      .order("available_stock", { ascending: true })
      .limit(10),
    supabase
      .from("orders")
      .select("id, order_number, customer_email, status, total_amount, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (lowStock.error) throw new Error(`Failed to load low stock: ${lowStock.error.message}`);
  if (recentOrders.error) throw new Error(`Failed to load recent orders: ${recentOrders.error.message}`);

  return {
    statusCounts: Object.fromEntries(statusCounts) as Record<OrderStatus, number>,
    lowStock: lowStock.data,
    recentOrders: recentOrders.data,
  };
}

export async function listAdminProducts() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, price, image_url, is_active, available_stock, updated_at, inventory(on_hand)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  return data;
}

export async function getAdminProduct(productId: string) {
  if (!z.uuid().safeParse(productId).success) return null;
  const supabase = await createServerSupabaseClient();

  const [product, movements] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, description, price, image_url, is_active, available_stock, created_at, updated_at, inventory(on_hand, updated_at)")
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("stock_movements")
      .select("id, movement_type, delta, on_hand_after, reason, reference, created_at, profiles(email)")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (product.error) throw new Error(`Failed to load product: ${product.error.message}`);
  if (movements.error) throw new Error(`Failed to load stock movements: ${movements.error.message}`);
  if (!product.data) return null;

  return { product: product.data, movements: movements.data };
}

export type AdminOrderFilters = { status: OrderStatus | null; query: string; page: number };

export function parseAdminOrderFilters(searchParams: Record<string, string | string[] | undefined>): AdminOrderFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = z.enum(ORDER_STATUSES).safeParse(first(searchParams.status));
  const page = z.coerce.number().int().min(1).max(10_000).safeParse(first(searchParams.page));
  return {
    status: status.success ? status.data : null,
    query: (first(searchParams.q) ?? "").trim().slice(0, 100),
    page: page.success ? page.data : 1,
  };
}

/** Escapes LIKE wildcards; PostgREST also treats `*` as a wildcard, so it is dropped. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`).replace(/\*/g, "");
}

export async function listAdminOrders({ status, query, page }: AdminOrderFilters) {
  const supabase = await createServerSupabaseClient();
  const from = (page - 1) * ADMIN_PAGE_SIZE;

  let request = supabase
    .from("orders")
    .select("id, order_number, customer_email, status, total_amount, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (status) request = request.eq("status", status);

  if (query) {
    const orderNumber = /^#?(\d{1,12})$/.exec(query);
    if (z.uuid().safeParse(query).success) request = request.eq("id", query);
    else if (orderNumber) request = request.eq("order_number", Number(orderNumber[1]));
    else request = request.ilike("customer_email", `%${escapeLikePattern(query)}%`);
  }

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return { orders: data, total: count ?? 0 };
}

export async function getAdminOrder(orderId: string) {
  if (!z.uuid().safeParse(orderId).success) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, user_id, customer_email, status, currency, total_amount, stripe_session_id, stripe_payment_intent_id, stripe_refund_id, checkout_expires_at, status_history, paid_at, fulfilled_at, cancelled_at, refunded_at, created_at, updated_at, order_items(id, product_id, product_name, product_sku, quantity, unit_price), profiles(display_name)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load order: ${error.message}`);
  return data;
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

export async function listStripeEvents() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("stripe_events")
    .select("id, event_type, order_id, outcome, duplicate_count, last_duplicate_at, processed_at, orders(order_number)")
    .order("processed_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to load webhook events: ${error.message}`);
  return data;
}
