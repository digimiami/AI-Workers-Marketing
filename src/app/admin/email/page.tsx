import { EmptyState } from "@/components/app/EmptyState";

export default function AdminEmailPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
        <p className="text-sm text-muted-foreground">
          Templates, sequences, steps, triggers, logs, and Resend integration.
        </p>
      </div>
      <EmptyState
        title="No email sequences loaded yet"
        description="Next step: connect sequences CRUD + send hooks."
        actionHref="/admin/settings"
        actionLabel="Configure Resend"
      />
    </div>
  );
}

