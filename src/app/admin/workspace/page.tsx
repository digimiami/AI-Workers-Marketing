import { redirect } from "next/navigation";

import { UnifiedAiWorkspaceClient } from "@/components/ai/UnifiedAiWorkspaceClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminWorkspaceNewPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <UnifiedAiWorkspaceClient organizationId={orgId} redirectOnRunId />;
}
