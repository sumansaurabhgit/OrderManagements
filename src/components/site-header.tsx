import { Store } from "lucide-react";
import Link from "next/link";

import { NavPills } from "@/components/nav-pills";
import { signOut } from "@/features/auth/actions";
import { CartLink } from "@/features/cart/cart-link";
import { getCurrentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const label = user?.displayName ?? user?.email ?? "";
  const initial = label.trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-zinc-950 px-4 py-2 text-xs text-zinc-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="flex items-center justify-center gap-2 sm:flex-1">
            <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            Live Inventory Sync — Stock reserves atomically at checkout
          </p>
          <p className="hidden shrink-0 sm:block">Stripe Test Mode • Instant Order Confirmation</p>
        </div>
      </div>

      <div className="border-b border-zinc-200/80 bg-white/85 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-950">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-950 text-white shadow-sm">
              <Store aria-hidden className="size-3.5" />
            </span>
            Larkspur Goods
            <span className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-zinc-400">
              STORE
            </span>
          </Link>

          <nav aria-label="Main" className="order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1">
            <NavPills showOrders={Boolean(user)} showAdmin={user?.role === "admin"} />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <CartLink />
            {user ? (
              <form action={signOut} className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-50 py-1 pr-3 pl-1.5">
                <span
                  aria-hidden
                  className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-600 text-[11px] font-medium text-white"
                >
                  {initial || "?"}
                </span>
                <span className="hidden max-w-28 truncate text-xs font-medium text-zinc-800 sm:inline">{label}</span>
                <button type="submit" className="text-xs text-zinc-500 transition-colors hover:text-zinc-950">
                  Sign out
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1">
                <Link href="/login" className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950">
                  Sign in
                </Link>
                <Link href="/signup" className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Painted immediately so the page query can start while the session resolves. */
export function SiteHeaderFallback() {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-zinc-950 px-4 py-2 text-xs text-zinc-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="flex items-center justify-center gap-2 sm:flex-1">
            <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            Live Inventory Sync — Stock reserves atomically at checkout
          </p>
          <p className="hidden shrink-0 sm:block">Stripe Test Mode • Instant Order Confirmation</p>
        </div>
      </div>
      <div className="border-b border-zinc-200/80 bg-white/85 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-950">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-950 text-white shadow-sm">
              <Store aria-hidden className="size-3.5" />
            </span>
            Larkspur Goods
            <span className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-zinc-400">
              STORE
            </span>
          </Link>
          <nav aria-label="Main" className="order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1">
            <div className="flex rounded-full border border-zinc-200/60 bg-zinc-100/90 p-1">
              <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 shadow-sm">Shop</span>
            </div>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <CartLink />
            <span aria-hidden className="h-8 w-24 animate-pulse rounded-full bg-zinc-100" />
          </div>
        </div>
      </div>
    </header>
  );
}
