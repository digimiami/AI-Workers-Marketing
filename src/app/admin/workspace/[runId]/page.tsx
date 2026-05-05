import { redirect } from "next/navigation";

import { AiWorkspacePage } from "@/components/workspace/AiWorkspacePage";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminWorkspaceRunPage(props: { params: Promise<{ runId: string }> }) {
  const { runId } = await props.params;
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AiWorkspacePage organizationId={orgId} runId={runId} />;
}
