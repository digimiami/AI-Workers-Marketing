import { redirect } from "next/navigation";

import { AiWorkersDashboard } from "@/app/admin/ai-workers/AiWorkersDashboard";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAgentsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AiWorkersDashboard organizationId={orgId} />;
}
