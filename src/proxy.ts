import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = ["/admin", "/orders"];

/**
 * First line of defence only: refreshes the session and redirects signed-out
 * visitors away from protected areas. It is NOT the authorisation boundary.
 * Admin pages, every Server Action and every Route Handler verify the user and
 * their database role again, and RLS enforces access inside Postgres.
 */
export async function proxy(request: NextRequest) {
  const { response, isSignedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !isSignedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and the Stripe webhook (it authenticates by signature).
    "/((?!_next/static|_next/image|favicon.ico|images/|api/webhooks/).*)",
  ],
};
