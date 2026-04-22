import { redirect } from "next/navigation";

import { CampaignAutomationClient } from "@/app/admin/campaigns/[campaignId]/automation/CampaignAutomationClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function CampaignAutomationPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <CampaignAutomationClient organizationId={orgId} />;
}

