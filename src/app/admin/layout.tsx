import { AdminNav } from "@/features/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

/**
 * Layout-level gate for /admin. Layouts do not re-render on every client
 * navigation and do not wrap Server Actions, so each admin page and action
 * also performs its own role check.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Admin</p>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
