"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "@/lib/orders";

/**
 * Client-side cart persisted in localStorage (survives reloads and browser
 * restarts, and syncs across tabs). It only stores what to display; prices and
 * stock are always re-validated by the server at checkout.
 */
const STORAGE_KEY = "larkspur.cart.v1";

const lineSchema = z.object({
  productId: z.uuid(),
  name: z.string(),
  unitPrice: z.number().int().nonnegative(),
  imageUrl: z.string().nullable(),
  quantity: z.number().int().positive(),
  availableStock: z.number().int().nonnegative(),
});

export type CartLine = z.infer<typeof lineSchema>;

export type CatalogueSnapshot = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  available_stock: number;
};

const EMPTY: CartLine[] = [];

type CartStore = {
  lines: CartLine[];
  hydrated: boolean;
  listeners: Set<() => void>;
};

// One store for the whole tab. The header badge and the cart page can load
// this module as separate copies; a module-level variable would let a removal
// update the list while the count stayed stale.
function getStore(): CartStore {
  if (typeof window === "undefined") {
    return { lines: EMPTY, hydrated: false, listeners: new Set() };
  }
  const host = window as Window & { __larkspurCart?: CartStore };
  if (!host.__larkspurCart) {
    host.__larkspurCart = { lines: EMPTY, hydrated: false, listeners: new Set() };
  }
  return host.__larkspurCart;
}

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = z.array(lineSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commit(next: CartLine[]) {
  const store = getStore();
  store.lines = next;
  store.hydrated = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode, quota); the in-memory cart still works.
  }
  for (const listener of store.listeners) listener();
}

function subscribe(listener: () => void) {
  const store = getStore();
  store.listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      store.lines = readStorage();
      store.hydrated = true;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    store.listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): CartLine[] {
  const store = getStore();
  if (!store.hydrated) {
    store.lines = readStorage();
    store.hydrated = true;
  }
  return store.lines;
}

function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Largest quantity a line may hold: available stock, capped per order. */
export function maxQuantityFor(availableStock: number): number {
  return Math.max(0, Math.min(availableStock, MAX_LINE_QUANTITY));
}

export const cart = {
  /** Adds units, clamped to what is purchasable. Returns the units actually added. */
  add(item: Omit<CartLine, "quantity">, quantity: number): number {
    const current = getSnapshot();
    const existing = current.find((line) => line.productId === item.productId);
    if (!existing && current.length >= MAX_CART_LINES) return 0;

    const max = maxQuantityFor(item.availableStock);
    const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, max);
    const added = nextQuantity - (existing?.quantity ?? 0);
    if (added <= 0) return 0;

    commit(
      existing
        ? current.map((line) =>
            line.productId === item.productId ? { ...line, ...item, quantity: nextQuantity } : line,
          )
        : [...current, { ...item, quantity: nextQuantity }],
    );
    return added;
  },

  setQuantity(productId: string, quantity: number) {
    commit(
      getSnapshot().map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.max(1, Math.min(quantity, maxQuantityFor(line.availableStock))) }
          : line,
      ),
    );
  },

  remove(productId: string) {
    commit(getSnapshot().filter((line) => line.productId !== productId));
  },

  clear() {
    commit(EMPTY);
  },

  productIds(): string[] {
    return getSnapshot().map((line) => line.productId);
  },

  /**
   * Applies fresh catalogue data: drops products that are no longer sold,
   * refreshes prices, and clamps quantities to current stock. Returns
   * human-readable notices describing every change.
   */
  reconcile(fresh: CatalogueSnapshot[]): string[] {
    const byId = new Map(fresh.map((product) => [product.id, product]));
    const notices: string[] = [];
    const next: CartLine[] = [];

    for (const line of getSnapshot()) {
      const product = byId.get(line.productId);
      if (!product) {
        notices.push(`"${line.name}" is no longer available and was removed from your cart.`);
        continue;
      }
      const max = maxQuantityFor(product.available_stock);
      if (max === 0) {
        notices.push(`"${product.name}" is out of stock and was removed from your cart.`);
        continue;
      }
      if (line.quantity > max) {
        notices.push(`Only ${max} of "${product.name}" can be ordered right now; your quantity was reduced.`);
      }
      if (line.unitPrice !== product.price) {
        notices.push(`The price of "${product.name}" has changed.`);
      }
      next.push({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        imageUrl: product.image_url,
        availableStock: product.available_stock,
        quantity: Math.min(line.quantity, max),
      });
    }

    commit(next);
    return notices;
  },
};
