import { EmptyState } from "@/components/app/EmptyState";

export default function AdminLogsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Audit logs, agent logs, email logs, and system errors.
        </p>
      </div>
      <EmptyState
        title="No logs loaded yet"
        description="Next step: connect `audit_logs`, `agent_logs`, and `email_logs` queries."
      />
    </div>
  );
}

