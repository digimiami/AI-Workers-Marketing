import { redirect } from "next/navigation";

import { SettingsClient } from "@/app/admin/settings/SettingsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminSettingsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Organization configuration, feature flags, cloud API tokens for OpenClaw, and operational controls. Public
          API overview: /docs/cloud-api
        </p>
      </div>
      <SettingsClient organizationId={orgId} />
    </div>
  );
}
