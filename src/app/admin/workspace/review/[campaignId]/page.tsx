import { redirect } from "next/navigation";

import { WorkspaceReviewClient } from "@/app/admin/workspace/review/WorkspaceReviewClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function WorkspaceReviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  const { campaignId } = await params;
  return <WorkspaceReviewClient organizationId={orgId} campaignId={campaignId} />;
}

