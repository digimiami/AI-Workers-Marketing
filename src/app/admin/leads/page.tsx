import { EmptyState } from "@/components/app/EmptyState";

export default function AdminLeadsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Capture, score, segment, and view timelines + email status.
        </p>
      </div>
      <EmptyState
        title="No leads loaded yet"
        description="Next step: connect lead capture and list queries."
        actionHref="/demo"
        actionLabel="Try public demo"
      />
    </div>
  );
}

