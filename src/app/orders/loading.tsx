export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-40 animate-pulse rounded bg-zinc-200" />
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-40 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}
