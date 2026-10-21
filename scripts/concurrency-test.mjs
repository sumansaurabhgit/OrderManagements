#!/usr/bin/env node
/**
 * Overselling test. Two different customers fire many concurrent checkout
 * reservations at a product holding exactly STOCK units, through the same
 * PostgREST RPC the app's checkout Server Action calls. Exactly STOCK
 * reservations must succeed; every other request must fail with
 * INSUFFICIENT_STOCK. The script restores the product's stock afterwards.
 *
 *   npm run test:concurrency
 *
 * Requires the seeded test accounts (admin@example.com / customer@example.com).
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./load-env.mjs";

const SKU = "LG-ORG-005";
const STOCK = 3;
const REQUESTS = 24;
const PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

const { url, anonKey } = loadEnv();

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`✘ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ ${message}`);
  }
}

const admin = await signIn("admin@example.com");
const buyers = [await signIn("customer@example.com"), admin];

const { data: product, error: productError } = await admin
  .from("products")
  .select("id, name, inventory(on_hand)")
  .eq("sku", SKU)
  .single();
if (productError) throw productError;

const originalOnHand = product.inventory.on_hand;
const adjust = async (delta, reason) => {
  if (delta === 0) return;
  const { error } = await admin.rpc("admin_adjust_stock", { p_product_id: product.id, p_delta: delta, p_reason: reason });
  if (error) throw error;
};

await adjust(STOCK - originalOnHand, "Concurrency test: set up stock");
console.log(`"${product.name}" has ${STOCK} units. Firing ${REQUESTS} concurrent reservations from 2 accounts…`);

const results = await Promise.all(
  Array.from({ length: REQUESTS }, (_, index) =>
    buyers[index % buyers.length]
      .rpc("create_order_and_reserve_stock", { p_items: [{ product_id: product.id, quantity: 1 }] })
      .then(({ data, error }) => ({ buyer: buyers[index % buyers.length], data, error })),
  ),
);

const succeeded = results.filter((result) => !result.error);
const failed = results.filter((result) => result.error);
const otherErrors = failed.filter((result) => !result.error.message.startsWith("INSUFFICIENT_STOCK"));

const { data: after } = await admin.from("inventory").select("on_hand").eq("product_id", product.id).single();

assert(succeeded.length === STOCK, `exactly ${STOCK} reservations succeeded (got ${succeeded.length})`);
assert(
  failed.length === REQUESTS - STOCK && otherErrors.length === 0,
  `the other ${REQUESTS - STOCK} were rejected with INSUFFICIENT_STOCK` +
    (otherErrors.length ? ` (unexpected: ${otherErrors.map((r) => r.error.message).join("; ")})` : ""),
);
assert(after.on_hand === 0, `on_hand is 0 after the race, never negative (got ${after.on_hand})`);

// Clean up: cancel the winning orders (releasing stock) and restore the original level.
for (const { buyer, data } of succeeded) {
  const { error } = await buyer.rpc("cancel_own_pending_order", { p_order_id: data.order_id, p_reason: "customer_cancelled" });
  if (error) throw error;
}
await adjust(originalOnHand - STOCK, "Concurrency test: restore stock");

const { data: restored } = await admin.from("inventory").select("on_hand").eq("product_id", product.id).single();
assert(restored.on_hand === originalOnHand, `stock restored to ${originalOnHand}; every change is in the movement log`);
