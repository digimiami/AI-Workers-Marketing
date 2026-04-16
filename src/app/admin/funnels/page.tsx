import { EmptyState } from "@/components/app/EmptyState";

export default function AdminFunnelsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Funnels</h1>
        <p className="text-sm text-muted-foreground">
          Visual list of funnels, steps, page content, CTAs, and A/B variants.
        </p>
      </div>
      <EmptyState
        title="No funnels loaded yet"
        description="Next step: connect to funnel CRUD and page editors."
        actionHref="/admin/campaigns"
        actionLabel="Go to campaigns"
      />
    </div>
  );
}

