import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-emerald-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-stone-600">
        The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/" className={`${buttonClasses()} mt-6`}>
        Back to the shop
      </Link>
    </div>
  );
}
