import { redirect } from "next/navigation";

import { AdCreativeClient } from "@/app/admin/ad-creative/AdCreativeClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAdCreativePage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ad Creative</h1>
        <p className="text-sm text-muted-foreground">
          Creative generations captured from the Ad Creative Generator worker (UI generation flow coming next).
        </p>
      </div>
      <AdCreativeClient organizationId={orgId} />
    </div>
  );
}

