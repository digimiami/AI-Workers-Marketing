import { PublicShell } from "@/components/marketing/PublicShell";

export default function CookiePolicyPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Cookie policy</h1>
        <p className="text-sm text-muted-foreground">
          TODO: Add final cookie policy and cookie consent UI. The platform is
          designed to support internal event tracking and PostHog integration.
        </p>
      </div>
    </PublicShell>
  );
}

