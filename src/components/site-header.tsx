import { Store } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { CartLink } from "@/features/cart/cart-link";
import { getCurrentUser } from "@/lib/auth";

const NAV_LINK = "rounded-md px-2 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
          <Store aria-hidden className="size-5 text-emerald-700" />
          Larkspur Goods
        </Link>

        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <Link href="/" className={NAV_LINK}>
            Shop
          </Link>
          {user ? (
            <Link href="/orders" className={NAV_LINK}>
              My orders
            </Link>
          ) : null}
          {user?.role === "admin" ? (
            <Link href="/admin" className={NAV_LINK}>
              Admin
            </Link>
          ) : null}
          <CartLink />

          {user ? (
            <form action={signOut} className="ml-2 flex items-center gap-2">
              <span className="hidden text-sm text-stone-500 sm:inline">{user.displayName ?? user.email}</span>
              <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Sign out
              </button>
            </form>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Link href="/login" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonClasses({ size: "sm" })}>
                Create account
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
