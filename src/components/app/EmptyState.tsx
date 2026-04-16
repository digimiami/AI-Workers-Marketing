import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/60 backdrop-blur p-8 text-center">
      <div className="text-lg font-semibold">{title}</div>
      {description ? (
        <div className="mt-2 text-sm text-muted-foreground">{description}</div>
      ) : null}
      {actionHref && actionLabel ? (
        <div className="mt-6">
          <Link href={actionHref} className={buttonVariants()}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

