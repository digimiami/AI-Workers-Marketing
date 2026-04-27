import { redirect } from "next/navigation";

import { OrganizationsClient } from "@/app/admin/organizations/OrganizationsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminOrganizationsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">Create, switch, and invite users to your organizations.</p>
      </div>
      <OrganizationsClient currentOrgId={orgId} />
    </div>
  );
}

