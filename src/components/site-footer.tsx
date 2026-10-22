import { Lock, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";

const LINK = "text-sm text-zinc-600 transition-colors hover:text-zinc-950";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-zinc-200/80 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-950">
            <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <Store aria-hidden className="size-3.5" />
            </span>
            Larkspur Goods
          </p>
          <p className="max-w-xs text-sm text-zinc-500">
            Production-shaped order & inventory management with atomic stock reservation.
          </p>
        </div>

        <nav aria-label="Footer" className="space-y-3">
          <p className="text-xs font-medium tracking-wider text-zinc-400">NAVIGATION</p>
          <ul className="space-y-2">
            <li><Link href="/" className={LINK}>Shop All</Link></li>
            <li><Link href="/orders" className={LINK}>My Orders</Link></li>
            <li><Link href="/cart" className={LINK}>Shopping Cart</Link></li>
            <li><Link href="/login" className={LINK}>Account</Link></li>
          </ul>
        </nav>

        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wider text-zinc-400">SYSTEM GUARANTEES</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <Lock aria-hidden className="size-3.5 text-zinc-500" />
              Real-Time Stock Locking
            </li>
            <li className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <ShieldCheck aria-hidden className="size-3.5 text-zinc-500" />
              Verified Stripe Checkout
            </li>
            <li className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <ShieldCheck aria-hidden className="size-3.5 text-zinc-500" />
              Row-Level Security Protected
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-200/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">© 2026 Larkspur Goods. All prices inc. VAT.</p>
          <ul className="flex flex-wrap gap-2">
            {["Stripe Verified", "Supabase Postgres", "SSL Encrypted"].map((badge) => (
              <li key={badge} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500">
                {badge}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
