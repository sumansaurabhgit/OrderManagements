export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-48 animate-pulse rounded bg-zinc-200" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="h-20 animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </ul>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}