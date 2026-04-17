import { redirect } from "next/navigation";

import { LogsClient } from "@/app/admin/logs/LogsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminLogsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <LogsClient organizationId={orgId} />;
}
