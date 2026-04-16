import Link from "next/link";

import { CtaBanner } from "@/components/marketing/cta-banner";

export function PageCloseCta({
  title = "Ready to map this to your offer?",
  description = "Book an AI workflow audit—we’ll map your funnel, workers, approvals, and telemetry into a connected operating flow.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-4">
      <CtaBanner
        title={title}
        description={description}
        primary={{ href: "/book", label: "Book audit" }}
        secondary={{ href: "/demo", label: "Run demo" }}
      />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Prefer to explore first?{" "}
        <Link href="/pricing" className="font-medium text-foreground underline-offset-4 hover:underline">
          View pricing
        </Link>{" "}
        or{" "}
        <Link href="/ai-workers" className="font-medium text-foreground underline-offset-4 hover:underline">
          meet the workers
        </Link>
        .
      </p>
    </section>
  );
}
