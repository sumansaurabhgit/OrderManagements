import type { Metadata } from "next";
import Link from "next/link";

import { ProductForm } from "@/features/admin/product-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-stone-500 hover:underline">
          ← Products
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">New product</h1>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <ProductForm />
      </div>
    </div>
  );
}
