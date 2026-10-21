import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-300",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  warning: "bg-amber-50 text-amber-800 ring-amber-300",
  danger: "bg-rose-50 text-rose-800 ring-rose-300",
  info: "bg-sky-50 text-sky-800 ring-sky-300",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
