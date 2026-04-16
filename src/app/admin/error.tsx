"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border p-6">
      <div className="text-lg font-semibold">Something went wrong</div>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}

