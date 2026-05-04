import { redirect } from "next/navigation";

import { UnifiedAiWorkspaceClient } from "@/components/ai/UnifiedAiWorkspaceClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminWorkspaceRunPage(props: { params: Promise<{ runId: string }> }) {
  const { runId } = await props.params;
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <UnifiedAiWorkspaceClient organizationId={orgId} runId={runId} />;
}
