export default function AdminLoading() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-44 rounded-md bg-muted animate-pulse" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border bg-muted/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

