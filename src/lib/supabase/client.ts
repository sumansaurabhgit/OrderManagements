"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser Supabase client (publishable anon key; all access governed by RLS). */
export function getBrowserSupabaseClient() {
  if (!client) {
    const { url, anonKey } = getSupabasePublicConfig();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
