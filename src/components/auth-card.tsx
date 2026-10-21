import type { ReactNode } from "react";

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
      {footer ? <div className="mt-4 text-center text-sm text-stone-600">{footer}</div> : null}
    </div>
  );
}
