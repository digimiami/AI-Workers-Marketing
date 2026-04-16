import { redirect } from "next/navigation";

import { RunDetailClient } from "@/app/admin/ai-workers/runs/[runId]/RunDetailClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  const { runId } = await params;

  return <RunDetailClient organizationId={orgId} runId={runId} />;
}
