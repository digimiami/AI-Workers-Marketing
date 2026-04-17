import { redirect } from "next/navigation";

import { LeadsClient } from "@/app/admin/leads/LeadsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminLeadsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <LeadsClient organizationId={orgId} />;
}
