import { PublicShell } from "@/components/marketing/PublicShell";

export default function AffiliateDisclosurePage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Affiliate disclosure
        </h1>
        <p className="text-sm text-muted-foreground">
          AiWorkers.vip may use affiliate links. This means we may earn a
          commission if you click a link and make a purchase, at no additional
          cost to you.
        </p>
      </div>
    </PublicShell>
  );
}

