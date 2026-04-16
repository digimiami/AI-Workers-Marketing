import { EmptyState } from "@/components/app/EmptyState";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Events ingestion, dashboards, charts, and top-performing assets.
        </p>
      </div>
      <EmptyState
        title="No analytics data yet"
        description="Next step: connect /api/events ingestion + dashboard queries + charts."
      />
    </div>
  );
}

