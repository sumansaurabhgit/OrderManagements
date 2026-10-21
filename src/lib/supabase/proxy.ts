import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookie on every request and reports whether
 * a user is signed in. Used by the proxy for coarse route gating only; pages,
 * Server Actions and Route Handlers re-verify the user and role themselves.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabasePublicConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getUser() validates the token with Supabase Auth (and refreshes it if
  // needed). Do not run code between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, isSignedIn: user !== null };
}
