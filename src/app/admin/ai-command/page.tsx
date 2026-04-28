import { redirect } from "next/navigation";

import { AiCommandCenterClient } from "@/app/admin/ai-command/AiCommandCenterClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAiCommandCenterPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AiCommandCenterClient organizationId={orgId} />;
}

