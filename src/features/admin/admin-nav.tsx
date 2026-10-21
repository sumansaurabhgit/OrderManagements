"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/products", label: "Products", exact: false },
  { href: "/admin/orders", label: "Orders", exact: false },
  { href: "/admin/webhooks", label: "Webhook events", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {LINKS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-emerald-700 text-white" : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
