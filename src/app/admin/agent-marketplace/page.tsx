import { redirect } from "next/navigation";

import { AgentMarketplaceAdmin } from "@/app/admin/agent-marketplace/AgentMarketplaceAdmin";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AgentMarketplaceAdminPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  return <AgentMarketplaceAdmin organizationId={orgId} />;
}
