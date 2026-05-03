import { redirect } from "next/navigation";

import { WorkspaceReviewRunClient } from "@/app/admin/workspace/review/run/[runId]/WorkspaceReviewRunClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function WorkspaceReviewRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  const { runId } = await params;
  return <WorkspaceReviewRunClient organizationId={orgId} runId={runId} />;
}
