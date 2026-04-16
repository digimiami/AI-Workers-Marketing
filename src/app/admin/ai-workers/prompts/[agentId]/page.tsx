import { redirect } from "next/navigation";

import { AgentPromptsClient } from "@/app/admin/ai-workers/prompts/[agentId]/AgentPromptsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AgentPromptsPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  const { agentId } = await params;

  return <AgentPromptsClient organizationId={orgId} agentId={agentId} />;
}
