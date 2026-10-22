export default function ProductLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-lg bg-zinc-100" />
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="h-9 w-3/4 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded bg-zinc-200" />
          <div className="h-6 w-32 animate-pulse rounded-full bg-zinc-100" />
          <div className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-md bg-zinc-200" />
        </div>
      </div>
    </div>
  );
}
