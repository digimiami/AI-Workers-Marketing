import { redirect } from "next/navigation";

import { CampaignPipelineClient } from "@/app/admin/campaigns/[campaignId]/pipeline/CampaignPipelineClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function CampaignPipelinePage(props: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await props.params;
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  return <CampaignPipelineClient organizationId={orgId} campaignId={campaignId} />;
}

