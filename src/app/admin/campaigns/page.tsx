import { redirect } from "next/navigation";

import { CampaignsClient } from "@/app/admin/campaigns/CampaignsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminCampaignsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <CampaignsClient organizationId={orgId} />
  );
}

