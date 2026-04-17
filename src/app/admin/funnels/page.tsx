import { redirect } from "next/navigation";

import { FunnelsClient } from "@/app/admin/funnels/FunnelsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminFunnelsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <FunnelsClient organizationId={orgId} />;
}
