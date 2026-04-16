import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          OpenClaw, Resend, analytics, affiliate defaults, approvals, branding, feature flags.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            This page will load org-scoped settings from the `settings` table and
            update feature flags safely.
          </p>
          <p>TODO: implement CRUD + validation + audit logging.</p>
        </CardContent>
      </Card>
    </div>
  );
}

