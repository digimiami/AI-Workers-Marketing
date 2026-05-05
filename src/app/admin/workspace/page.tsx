import { redirect } from "next/navigation";

import { AiWorkspacePage } from "@/components/workspace/AiWorkspacePage";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminWorkspaceNewPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AiWorkspacePage organizationId={orgId} redirectOnRunId />;
}
