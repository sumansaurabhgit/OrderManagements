export const LOW_STOCK_THRESHOLD = 3;

function Dot({ tone }: { tone: "emerald" | "amber" }) {
  const color = tone === "emerald" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <span className="relative flex size-1.5 shrink-0" aria-hidden>
      {tone === "amber" ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-70 motion-reduce:hidden" />
      ) : null}
      <span className={`relative size-1.5 rounded-full ${color}`} />
    </span>
  );
}

export function StockBadge({ available }: { available: number }) {
  if (available <= 0) {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-white">
        Sold out
      </span>
    );
  }

  if (available <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
        <Dot tone="amber" />
        {available === 1 ? "Only 1 left" : `Low stock · ${available}`}
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
      <Dot tone="emerald" />
      In stock · {available}
    </span>
  );
}
