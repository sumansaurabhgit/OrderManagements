import "server-only";

import { cache } from "react";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const STOREFRONT_COLUMNS = "id, sku, name, description, price, image_url, available_stock";

export type StorefrontProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  available_stock: number;
};

/** Active catalogue. RLS already hides inactive products from the public; the
 * explicit filter keeps admins' storefront view identical to customers'. */
export async function listActiveProducts(): Promise<StorefrontProduct[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(STOREFRONT_COLUMNS)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load products: ${error.message}`);
  return data;
}

export const getActiveProduct = cache(async (id: string): Promise<StorefrontProduct | null> => {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(STOREFRONT_COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Failed to load product: ${error.message}`);
  return data;
});
