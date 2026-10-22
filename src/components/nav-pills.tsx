"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEM = "rounded-full px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-950";
const ACTIVE = "rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 shadow-sm";

export function NavPills({ showOrders, showAdmin }: { showOrders: boolean; showAdmin: boolean }) {
  const pathname = usePathname();
  const shopActive = pathname === "/" || pathname.startsWith("/products");
  const ordersActive = pathname.startsWith("/orders");
  const adminActive = pathname.startsWith("/admin");

  return (
    <div className="flex rounded-full border border-zinc-200/60 bg-zinc-100/90 p-1">
      <Link href="/" className={shopActive ? ACTIVE : ITEM} aria-current={shopActive ? "page" : undefined}>
        Shop
      </Link>
      {showOrders ? (
        <Link href="/orders" className={ordersActive ? ACTIVE : ITEM} aria-current={ordersActive ? "page" : undefined}>
          My orders
        </Link>
      ) : null}
      {showAdmin ? (
        <Link href="/admin" className={adminActive ? ACTIVE : ITEM} aria-current={adminActive ? "page" : undefined}>
          Admin
        </Link>
      ) : null}
    </div>
  );
}
