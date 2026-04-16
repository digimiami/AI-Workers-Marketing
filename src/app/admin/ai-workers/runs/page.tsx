import { redirect } from "next/navigation";

import { RunsHistoryClient } from "@/app/admin/ai-workers/runs/RunsHistoryClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AgentRunsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <RunsHistoryClient organizationId={orgId} />;
}
