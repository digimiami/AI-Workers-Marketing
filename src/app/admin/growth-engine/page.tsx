import { redirect } from "next/navigation";

import { GrowthEngineSystemClient } from "@/app/admin/growth-engine/GrowthEngineSystemClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function GrowthEnginePage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <GrowthEngineSystemClient organizationId={orgId} />;
}
