import { redirect } from "next/navigation";

import { AiWorkersDashboard } from "@/app/admin/ai-workers/AiWorkersDashboard";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAiWorkersPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AiWorkersDashboard organizationId={orgId} />;
}
