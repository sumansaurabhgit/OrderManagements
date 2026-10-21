import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/env";
import { getServiceRoleKey } from "@/lib/server-env";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses RLS, so it is reserved for trusted server
 * operations that have no end-user session: the Stripe webhook and storing a
 * server-created Checkout Session on its order. It only ever calls
 * purpose-built SECURITY DEFINER functions granted to `service_role`.
 */
export function createAdminSupabaseClient() {
  const { url } = getSupabasePublicConfig();
  return createClient<Database>(url, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
