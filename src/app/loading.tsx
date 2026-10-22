export default function StorefrontLoading() {
  return (
    <div>
      <div className="mb-8 h-56 animate-pulse rounded-3xl bg-zinc-200" />
      <div className="mb-6 h-14 animate-pulse rounded-2xl bg-zinc-100" />
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
            <div className="aspect-square animate-pulse bg-zinc-100" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="h-9 animate-pulse rounded-full bg-zinc-200" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
