import { redirect } from "next/navigation";

import { CampaignDetailClient } from "@/app/admin/campaigns/[campaignId]/CampaignDetailClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function CampaignDetailPage(
  props: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await props.params;
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <CampaignDetailClient organizationId={orgId} campaignId={campaignId} />;
}

