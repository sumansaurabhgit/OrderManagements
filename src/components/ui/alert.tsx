import type { ReactNode } from "react";

type Tone = "error" | "success" | "info" | "warning";

const TONES: Record<Tone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

/** Errors use role="alert" (assertive); everything else is a polite status. */
export function Alert({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-sm ${TONES[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
